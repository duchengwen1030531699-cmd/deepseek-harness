/** Client CSS Modules type shim (matches the shared declaration). */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
