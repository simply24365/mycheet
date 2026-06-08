export function getFileName(filePath?: string | null): string {
  return (filePath || "").replace(/\\/g, "/").split("/").pop() || "";
}
