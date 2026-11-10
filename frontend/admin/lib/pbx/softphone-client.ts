/**
 * Cliente SIP del softphone del backoffice.
 *
 * Porta la lógica de ~/Downloads/files/dashboard/softphone.html (probada contra
 * el Asterisk de svr01) a una clase sin React: registro, llamadas entrantes y
 * salientes, mute, espera y DTMF. SIP.js se importa de forma dinámica porque
 * usa WebSocket y WebRTC, que no existen al renderizar en servidor.
 */
import type { Invitation, Registerer, Session, UserAgent, Web } from "sip.js"

import type {
  CallInfo,
  CallLogEntry,
  PBXConnectionConfig,
  SoftphoneSnapshot,
} from "./types"

type SipModule = typeof import("sip.js")

export const INITIAL_SNAPSHOT: SoftphoneSnapshot = {
  registration: "disconnected",
  error: null,
  call: "idle",
  callInfo: null,
  muted: false,
  onHold: false,
}

// Si nadie contesta una llamada entrante, se rechaza (igual que softphone.html)
const RING_TIMEOUT_MS = 45_000

interface SoftphoneListeners {
  onChange: (snapshot: SoftphoneSnapshot) => void
  onCallEnded?: (entry: CallLogEntry) => void
}

/** Tonos de timbre y de llamada saliente con Web Audio (440 Hz + 480 Hz). */
class ToneGenerator {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null

  ringtone() {
    this.play(0.12, 1.6, 3500)
  }

  ringback() {
    this.play(0.08, 1.8, 4000)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  close() {
    this.stop()
    this.ctx?.close().catch(() => {})
    this.ctx = null
  }

  private context() {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) this.ctx = new AudioContextClass()
    }
    if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {})
    return this.ctx
  }

  private play(volume: number, seconds: number, everyMs: number) {
    this.stop()
    const ctx = this.context()
    if (!ctx) return
    const beep = () => {
      try {
        const gain = ctx.createGain()
        gain.gain.setValueAtTime(volume, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds)
        gain.connect(ctx.destination)
        for (const frequency of [440, 480]) {
          const osc = ctx.createOscillator()
          osc.frequency.value = frequency
          osc.connect(gain)
          osc.start()
          osc.stop(ctx.currentTime + seconds)
        }
      } catch {
        // Sin audio no se bloquea la llamada
      }
    }
    beep()
    this.timer = setInterval(beep, everyMs)
  }
}

export class SoftphoneClient {
  private sip: SipModule | null = null
  private ua: UserAgent | null = null
  private registerer: Registerer | null = null
  private session: Session | null = null
  private callStartedAt: number | null = null
  private ringTimeout: ReturnType<typeof setTimeout> | null = null
  private tones = new ToneGenerator()
  private snapshot: SoftphoneSnapshot = INITIAL_SNAPSHOT

  constructor(
    private readonly config: PBXConnectionConfig,
    private readonly remoteAudio: () => HTMLAudioElement | null,
    private readonly listeners: SoftphoneListeners,
  ) {}

  getSnapshot() {
    return this.snapshot
  }

  async connect() {
    const { registration } = this.snapshot
    if (this.ua && (registration === "registered" || registration === "connecting")) return
    // Tras un error el UserAgent sigue vivo: se descarta antes de volver a registrar
    if (this.ua) await this.teardown()
    this.set({ registration: "connecting", error: null })
    try {
      const SIP = this.sip ?? (this.sip = await import("sip.js"))
      const { sipServer, sipDomain, sipExtension, sipPassword } = this.config
      const uri = SIP.UserAgent.makeURI(`sip:${sipExtension}@${sipDomain}`)
      if (!uri) throw new Error("La extensión o el dominio SIP no son válidos")

      const ua: UserAgent = new SIP.UserAgent({
        uri,
        transportOptions: {
          server: sipServer,
          keepAliveInterval: 15,
          keepAliveDebounce: 10,
        },
        authorizationUsername: sipExtension,
        authorizationPassword: sipPassword,
        sessionDescriptionHandlerFactoryOptions: { constraints: { audio: true, video: false } },
        logLevel: "debug",
        delegate: {
          onInvite: (invitation) => this.handleInvite(invitation),
          onDisconnect: (error) => {
            // Sin error es una desconexión pedida por nosotros
            if (this.ua !== ua || !error) return
            this.set({ registration: "error", error: "Se perdió la conexión con la central" })
          },
        },
      })
      const registerer = new SIP.Registerer(ua, {
        registrar: uri,
        expires: 120,
        refreshFrequency: 90,
      })
      registerer.stateChange.addListener((state) => {
        if (this.registerer !== registerer) return
        if (state === SIP.RegistererState.Registered) {
          this.set({ registration: "registered", error: null })
        } else if (state === SIP.RegistererState.Unregistered && this.snapshot.registration !== "error") {
          this.set({ registration: "error", error: "La central rechazó el registro de la extensión" })
        }
      })

      this.ua = ua
      this.registerer = registerer
      await ua.start()
      await registerer.register({
        requestDelegate: {
          onReject: (response) => {
            const code = response.message.statusCode
            this.set({
              registration: "error",
              error: code === 401 || code === 403
                ? "Extensión o contraseña incorrectas"
                : `La central rechazó el registro (${code})`,
            })
          },
        },
      })
    } catch (error) {
      await this.teardown()
      this.set({
        registration: "error",
        error: error instanceof Error && error.message
          ? `No se pudo conectar con la central: ${error.message}`
          : "No se pudo conectar con la central",
      })
    }
  }

  async disconnect() {
    this.clearRingTimeout()
    this.tones.stop()
    await this.hangup().catch(() => {})
    await this.teardown()
    this.tones.close()
    this.set(INITIAL_SNAPSHOT)
  }

  async call(target: string) {
    const SIP = this.sip
    const number = target.trim()
    if (!SIP || !this.ua || this.snapshot.registration !== "registered") {
      throw new Error("El teléfono no está conectado")
    }
    if (this.session) throw new Error("Ya hay una llamada en curso")
    if (!number) throw new Error("Escribe un número")

    const uri = SIP.UserAgent.makeURI(`sip:${number}@${this.config.sipDomain}`)
    if (!uri) throw new Error("El número no es válido")

    const inviter = new SIP.Inviter(this.ua, uri, {
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    })
    const info: CallInfo = { direction: "outbound", number, name: null, startedAt: null }
    this.bindSession(inviter, info)
    this.set({ call: "dialing" })
    this.tones.ringback()
    try {
      await inviter.invite()
    } catch (error) {
      this.finishCall(inviter, info)
      throw error
    }
  }

  async answer() {
    const SIP = this.sip
    const session = this.session
    if (!SIP || !(session instanceof SIP.Invitation) || this.snapshot.call !== "ringing") return
    this.clearRingTimeout()
    this.tones.stop()
    await session.accept({
      sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
    })
  }

  async decline() {
    const SIP = this.sip
    const session = this.session
    if (!SIP || !(session instanceof SIP.Invitation)) return
    this.tones.stop()
    await session.reject().catch(() => {})
  }

  async hangup() {
    const SIP = this.sip
    const session = this.session
    if (!SIP || !session) return
    switch (session.state) {
      case SIP.SessionState.Initial:
      case SIP.SessionState.Establishing:
        if (session instanceof SIP.Inviter) await session.cancel()
        else if (session instanceof SIP.Invitation) await session.reject()
        break
      case SIP.SessionState.Established:
        await session.bye()
        break
    }
  }

  toggleMute() {
    if (this.snapshot.call !== "active") return
    const muted = !this.snapshot.muted
    this.setMicrophoneEnabled(!muted && !this.snapshot.onHold)
    this.set({ muted })
  }

  /**
   * Espera: corta el audio en ambos sentidos sin renegociar la sesión, igual
   * que softphone.html, que es lo que ya funciona contra esa central.
   */
  toggleHold() {
    if (this.snapshot.call !== "active") return
    const onHold = !this.snapshot.onHold
    this.setMicrophoneEnabled(!onHold && !this.snapshot.muted)
    const audio = this.remoteAudio()
    if (audio) audio.muted = onHold
    this.set({ onHold })
  }

  async sendDTMF(tone: string) {
    if (!this.session || this.snapshot.call !== "active") return
    await this.session.info({
      requestOptions: {
        body: {
          contentDisposition: "render",
          contentType: "application/dtmf-relay",
          content: `Signal=${tone}\r\nDuration=100`,
        },
      },
    })
  }

  async transfer(target: string) {
    const SIP = this.sip
    const session = this.session
    const number = target.trim()
    if (!SIP || !session || this.snapshot.call !== "active") {
      throw new Error("No hay una llamada activa para transferir")
    }
    if (!number) throw new Error("Escribe la extensión o número de destino")

    const uri = SIP.UserAgent.makeURI(`sip:${number}@${this.config.sipDomain}`)
    if (!uri) throw new Error("El destino de transferencia no es válido")
    await session.refer(uri)
  }

  // ─── internos ───────────────────────────────────────────

  private set(patch: Partial<SoftphoneSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.listeners.onChange(this.snapshot)
  }

  private async teardown() {
    const ua = this.ua
    const registerer = this.registerer
    this.ua = null
    this.registerer = null
    try {
      await registerer?.unregister()
    } catch {
      // Ya estaba sin registrar o sin conexión
    }
    try {
      await ua?.stop()
    } catch {
      // Ignorado: la conexión ya estaba cerrada
    }
  }

  private handleInvite(invitation: Invitation) {
    // Una sola llamada a la vez: la segunda recibe "ocupado"
    if (this.session) {
      invitation.reject({ statusCode: 486 }).catch(() => {})
      return
    }
    const identity = invitation.remoteIdentity
    const info: CallInfo = {
      direction: "inbound",
      number: identity.uri.user || "Desconocido",
      name: identity.displayName || null,
      startedAt: null,
    }
    this.bindSession(invitation, info)
    this.set({ call: "ringing" })
    this.tones.ringtone()
    invitation.progress().catch((err) => {
      console.error("[Softphone] Error al enviar 180 Ringing:", err)
    })
    this.ringTimeout = setTimeout(() => {
      if (this.session === invitation && this.snapshot.call === "ringing") this.decline()
    }, RING_TIMEOUT_MS)
  }

  private bindSession(session: Session, info: CallInfo) {
    const SIP = this.sip
    if (!SIP) return
    this.session = session
    this.set({ callInfo: info, muted: false, onHold: false })
    session.stateChange.addListener((state) => {
      if (this.session !== session) return
      if (state === SIP.SessionState.Established) {
        this.clearRingTimeout()
        this.tones.stop()
        this.callStartedAt = Date.now()
        this.attachRemoteAudio(session)
        this.set({ call: "active", callInfo: { ...info, startedAt: this.callStartedAt } })
      } else if (state === SIP.SessionState.Terminated) {
        this.finishCall(session, info)
      }
    })
  }

  private finishCall(session: Session, info: CallInfo) {
    if (this.session !== session) return
    this.clearRingTimeout()
    this.tones.stop()
    const answered = this.callStartedAt !== null
    const durationSec = answered ? Math.round((Date.now() - (this.callStartedAt as number)) / 1000) : 0
    this.listeners.onCallEnded?.({
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      direction: info.direction,
      number: info.number,
      name: info.name,
      missed: info.direction === "inbound" && !answered,
      endedAt: Date.now(),
      durationSec,
    })
    this.session = null
    this.callStartedAt = null
    const audio = this.remoteAudio()
    if (audio) {
      audio.srcObject = null
      audio.muted = false
    }
    this.set({ call: "idle", callInfo: null, muted: false, onHold: false })
  }

  private attachRemoteAudio(session: Session) {
    const audio = this.remoteAudio()
    const handler = session.sessionDescriptionHandler as Web.SessionDescriptionHandler | undefined
    if (!audio || !handler) return

    audio.muted = false
    audio.volume = 1.0

    const playAudio = () => {
      audio.play().catch((err) => {
        console.warn("⚠️ [Softphone] audio.play() advertencia:", err)
      })
    }

    const stream = handler.remoteMediaStream
    if (stream) {
      audio.srcObject = stream
      playAudio()
      stream.onaddtrack = () => {
        console.log("🔊 [Softphone] stream onaddtrack disparado")
        playAudio()
      }
    }

    if (handler.peerConnection) {
      handler.peerConnection.ontrack = (event) => {
        console.log("🔊 [Softphone] peerConnection ontrack:", event.track.kind)
        if (event.streams && event.streams[0]) {
          audio.srcObject = event.streams[0]
        } else if (stream) {
          audio.srcObject = stream
        }
        playAudio()
      }
    }
  }

  private setMicrophoneEnabled(enabled: boolean) {
    const handler = this.session?.sessionDescriptionHandler as Web.SessionDescriptionHandler | undefined
    handler?.peerConnection?.getSenders().forEach((sender) => {
      if (sender.track?.kind === "audio") sender.track.enabled = enabled
    })
  }

  private clearRingTimeout() {
    if (this.ringTimeout) clearTimeout(this.ringTimeout)
    this.ringTimeout = null
  }
}

/**
 * Prueba de una configuración desde el formulario de integración: registra la
 * extensión, espera respuesta de la central y se desconecta.
 */
export function testPbxConnection(
  config: PBXConnectionConfig,
  timeoutMs = 10_000,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    let settled = false
    const client = new SoftphoneClient(config, () => null, {
      onChange: (snapshot) => {
        if (snapshot.registration === "registered") {
          finish({ success: true, message: `La extensión ${config.sipExtension} se registró correctamente` })
        } else if (snapshot.registration === "error") {
          finish({ success: false, message: snapshot.error || "No se pudo registrar la extensión" })
        }
      },
    })
    const timer = setTimeout(
      () => finish({ success: false, message: "La central no respondió a tiempo" }),
      timeoutMs,
    )
    function finish(result: { success: boolean; message: string }) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      client.disconnect().finally(() => resolve(result))
    }
    client.connect()
  })
}
