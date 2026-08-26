function resolveLocalImagePaths(text, sessionId, mediaUrl) {
  return text.replace(
    /!\[([^\]]*)\]\(\s*([^)]*?)\s*\)(\{[^}]*\})?/g,
    (_match, alt, src, attrs = "") => {
      const trimmedSrc = src.trim()
      const isLocal = !/^https?:\/\//i.test(trimmedSrc) && !/^data:/i.test(trimmedSrc)
      if (!isLocal) return _match
      const filename = trimmedSrc.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? trimmedSrc
      const resolvedUrl = mediaUrl(sessionId, filename)
      return `![${alt}](${resolvedUrl})${attrs}`
    }
  )
}
const text = `![](/var/folders/1k/qc7m9b9j3ql35cjh1yglqh680000gn/T/quiz-import-media-G7klgK/media/image1.png){width="3.660378390201225in"\nheight="2.168208661417323in"}`;
console.log(resolveLocalImagePaths(text, "SESSION", (s, f) => `http://localhost:9000/import/${s}/media/${f}`));
