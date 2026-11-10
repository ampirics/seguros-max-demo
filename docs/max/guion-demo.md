# Guion de la demo: MAX Corredores de Seguros

Unos 12 minutos. Laptop con el panel en Dirección y un celular (o segunda pestaña) con `/simulador`. Antes de llegar,
reiniciar los datos: `curl -X POST http://localhost:3300/srv/seguros/accion -H 'Content-Type: application/json' -d '{"tipo":"reiniciar"}'`.

Mensaje central: no es un chatbot más. Es más capacidad comercial y mejor servicio, con el ejecutivo en las decisiones.

## 1. El problema (30 s)

"Hoy un interesado llena un formulario o escribe por WhatsApp y espera. Fuera de horario nadie le contesta, y cuando llega
al ejecutivo le faltan datos." Son hipótesis de la propuesta (4.2): se validan con ellos.

## 2. El inicio del director (1 min)

`/admin`: conversaciones de hoy, solicitudes nuevas, quién espera a un ejecutivo, lo resuelto por la IA. "Requiere
atención": la distribuidora que espera a Manuel, la queja del reclamo, pólizas que vencen sin aviso. Primera respuesta de
47 segundos contra 3.5 horas antes. Todo enlaza.

## 3. La IA capta y precalifica (3 min)

En el celular, `/simulador`, escribir: "Buenas, ¿cuánto me sale asegurar mi Toyota RAV4 2023?".

- No inventa la prima: explica que cada aseguradora da la suya y sigue con lo que falta (uso, cobertura).
- Pide la autorización de datos y lo dice para qué (Ley 172-13).
- Califica y asigna a una ejecutiva por ramo y carga.

En la laptop, la conversación entra sola a la bandeja. El panel del caso muestra la ficha, lo que hizo la IA y lo que falta.
Abrir la solicitud en Oportunidades.

Después, "Tengo una ferretería en Santiago y quiero asegurar el local y la mercancía": va a la ejecutiva de empresas de
Santiago sin recomendar una póliza.

## 4. El comparativo (2 min)

En la ficha de la oportunidad, "Rellenar con primas de ejemplo" (o cargar tres aseguradoras), ver la recomendada,
"Enviar comparativo por WhatsApp": aparece en el celular. "Emitir póliza con esta": la póliza queda en la cartera.

## 5. Siniestro (2 min)

En el simulador, "Escribir como un asegurado de la cartera" > Asegurado con vehículo, y "Tuve un choque, ¿qué hago?".

- Primero pregunta si hay heridos.
- Abre el caso con su póliza y da los pasos y documentos oficiales de MAX.
- No confirma cobertura ni pago: eso es de la aseguradora.

En `/admin/siniestros` aparece el caso con la marca IA. En la ficha, marcar un documento y pasarlo a "En la aseguradora"
con un número de reclamo: el asegurado recibe el aviso.

## 6. Servicio y seguridad (1 min 30 s)

Con el mismo asegurado, "¿Mi póliza está al día?": pide los últimos 4 de la cédula (salen en el botón del perfil). Con un
número equivocado no da nada. Luego "¿Me cubre si choco en Puerto Rico?": no interpreta el contrato, lo pasa al equipo con el
motivo y el resumen.

## 7. Cartera y renovaciones (1 min)

`/admin/cartera`: lo que vence en 15, 30 y 60 días con su prima. Seleccionar las que no tienen aviso y "Enviar aviso de
renovación". En el simulador, con "Póliza por renovar", responder "Sí, renuévenla igual".

## 8. Indicadores y cierre (1 min)

`/admin/indicadores`: los indicadores de la propuesta (primera respuesta, calificación, conversión a cotización y a póliza,
contención), antes y con ORA, por canal, ramo y ejecutivo. "Los denominadores se fijan con ustedes antes del piloto."

Cierre: "Proponemos un piloto de 4 a 8 semanas con uno o dos ramos, medir y decidir juntos." Preguntas clave de la
propuesta, sección 11: CRM y cotizador que usan, volúmenes por canal, qué operaciones exigen validación humana.

## Si algo falla

- La IA no responde: falta `ANTHROPIC_API_KEY` o no hay internet. La conversación pasa sola a servicio con el aviso; seguir
  con las conversaciones sembradas de la bandeja, que muestran los mismos escenarios.
- Datos alterados por pruebas: reiniciar con el `curl` de arriba.
