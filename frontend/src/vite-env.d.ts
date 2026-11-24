/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_ID?: string
}

declare module "*.csv?raw" {
  const contenido: string
  export default contenido
}
