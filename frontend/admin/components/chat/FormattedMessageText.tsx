import { Fragment, ReactNode } from "react"

interface FormattedMessageTextProps {
  text?: string | null
  isAdmin?: boolean
  className?: string
}

const BULLET_PATTERN = /^\s*[-*]\s+(.+)$/
const INLINE_PATTERN = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(https?:\/\/[^\s]+))/g

function splitTrailingUrlPunctuation(url: string): { cleanUrl: string; trailing: string } {
  const match = url.match(/^(.*?)([),.!?;:]+)?$/)

  if (!match) {
    return { cleanUrl: url, trailing: "" }
  }

  return {
    cleanUrl: match[1] || url,
    trailing: match[2] || "",
  }
}

function renderInlineText(text: string, isAdmin: boolean, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let matchIndex = 0

  const linkClassName = isAdmin
    ? "underline text-blue-100 hover:text-white break-all"
    : "underline text-blue-600 hover:text-blue-800 break-all"

  const inlineCodeClassName = isAdmin
    ? "font-mono text-xs px-1 py-0.5 rounded bg-white/20"
    : "font-mono text-xs px-1 py-0.5 rounded bg-gray-200 text-gray-900"

  INLINE_PATTERN.lastIndex = 0
  let match = INLINE_PATTERN.exec(text)

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-text-${matchIndex}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      )
    }

    const [fullMatch, , markdownLabel, markdownUrl, inlineCode, boldText, italicText, rawUrl] = match

    if (markdownLabel && markdownUrl) {
      nodes.push(
        <a
          key={`${keyPrefix}-mdlink-${matchIndex}`}
          href={markdownUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {markdownLabel}
        </a>
      )
    } else if (inlineCode) {
      nodes.push(
        <code key={`${keyPrefix}-code-${matchIndex}`} className={inlineCodeClassName}>
          {inlineCode}
        </code>
      )
    } else if (boldText) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${matchIndex}`} className="font-semibold">
          {boldText}
        </strong>
      )
    } else if (italicText) {
      nodes.push(
        <em key={`${keyPrefix}-italic-${matchIndex}`} className="italic">
          {italicText}
        </em>
      )
    } else if (rawUrl) {
      const { cleanUrl, trailing } = splitTrailingUrlPunctuation(rawUrl)
      nodes.push(
        <a
          key={`${keyPrefix}-rawlink-${matchIndex}`}
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {cleanUrl}
        </a>
      )

      if (trailing) {
        nodes.push(
          <Fragment key={`${keyPrefix}-trail-${matchIndex}`}>
            {trailing}
          </Fragment>
        )
      }
    } else {
      nodes.push(
        <Fragment key={`${keyPrefix}-fallback-${matchIndex}`}>
          {fullMatch}
        </Fragment>
      )
    }

    lastIndex = match.index + fullMatch.length
    matchIndex += 1
    match = INLINE_PATTERN.exec(text)
  }

  if (lastIndex < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-text-end`}>
        {text.slice(lastIndex)}
      </Fragment>
    )
  }

  return nodes
}

export default function FormattedMessageText({ text, isAdmin = false, className = "" }: FormattedMessageTextProps) {
  if (!text) {
    return null
  }

  const lines = text.split(/\r?\n/)
  const contentBlocks: ReactNode[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const currentLine = lines[i]

    if (currentLine.trim() === "") {
      contentBlocks.push(<div key={`spacer-${i}`} className="h-2" />)
      continue
    }

    const bulletMatch = currentLine.match(BULLET_PATTERN)
    if (bulletMatch) {
      const listItems: ReactNode[] = []
      let j = i

      while (j < lines.length) {
        const listLine = lines[j]
        const listLineMatch = listLine.match(BULLET_PATTERN)

        if (!listLineMatch) {
          break
        }

        listItems.push(
          <li key={`li-${j}`} className="leading-relaxed">
            {renderInlineText(listLineMatch[1], isAdmin, `li-${j}`)}
          </li>
        )

        j += 1
      }

      contentBlocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-1">
          {listItems}
        </ul>
      )

      i = j - 1
      continue
    }

    contentBlocks.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInlineText(currentLine, isAdmin, `p-${i}`)}
      </p>
    )
  }

  return <div className={`text-sm break-words ${className}`}>{contentBlocks}</div>
}
