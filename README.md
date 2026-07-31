# Dosis

Aplicación web móvil para recordarte cuándo tomarte las pastillas.

**App en vivo:** https://julianalvarez07.github.io/dosis/

## Qué hace

- Agregás pastillas con nombre, dosis y horarios
- Ves la lista de hoy y marcás cada toma
- Podés activar avisos del navegador
- Se puede instalar en el celular como app (PWA)
- Los datos quedan guardados en el teléfono (localStorage)

## Cómo instalarla en el celular

Abrí https://julianalvarez07.github.io/dosis/ en el navegador del teléfono.

**Android (Chrome)**
1. Tocá el menú ⋮ arriba a la derecha
2. Elegí **Instalar app** o **Agregar a la pantalla de inicio**
3. Confirmá — queda el ícono de Dosis como una app

**iPhone (Safari)**
1. Tocá el botón Compartir (el cuadrado con la flecha)
2. Bajá y elegí **Agregar a pantalla de inicio**
3. Tocá **Agregar** — queda el ícono en tu pantalla de inicio

Después abrila desde ese ícono y tocá **Mis pastillas → Activar avisos** para los recordatorios.

## Desarrollo

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

## Stack

- Vite + JavaScript
- PWA (manifest + service worker)
- Notificaciones del navegador
