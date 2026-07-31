# Dosis

Aplicación web móvil para recordarte cuándo tomarte las pastillas.

**App en vivo:** https://julianalvarez07.github.io/dosis/

## Qué hace

- Agregás pastillas con nombre, dosis y horarios
- Ves la lista de hoy y marcás cada toma
- Podés activar avisos del navegador
- Se puede instalar en el celular como app (PWA)
- Los datos quedan guardados en el teléfono (localStorage)

## Cómo usarla en el celular

1. Abrí https://julianalvarez07.github.io/dosis/ en Chrome (Android) o Safari (iPhone)
2. En Android: menú → **Instalar app** / **Agregar a la pantalla de inicio**
3. En iPhone: Compartir → **Agregar a pantalla de inicio**
4. Tocá **Mis pastillas → Activar avisos** para recibir recordatorios

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
