/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module '*.css';
declare module '*.svg' {
  const src: string;
  export default src;
}
