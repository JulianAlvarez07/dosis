import './style.css'

const STORAGE_KEY = 'dosis.meds.v1'
const LOG_KEY = 'dosis.log.v1'
const NOTIFIED_KEY = 'dosis.notified.v1'

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const state = {
  meds: loadMeds(),
  log: loadLog(),
  draftTimes: ['08:00'],
  draftName: '',
  draftDose: '',
  sheet: null,
  toastTimer: null,
}

const app = document.querySelector('#app')

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`
}

function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadMeds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveMeds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.meds))
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveLog() {
  localStorage.setItem(LOG_KEY, JSON.stringify(state.log))
}

function loadNotified() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveNotified(map) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map))
}

function formatDateLabel(date = new Date()) {
  const weekday = WEEKDAYS[date.getDay()]
  return `${weekday} ${date.getDate()} de ${MONTHS[date.getMonth()]}`
}

function parseTime(value) {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

function periodLabel(time) {
  const minutes = parseTime(time)
  if (minutes < 12 * 60) return 'mañana'
  if (minutes < 18 * 60) return 'tarde'
  return 'noche'
}

function doseKey(medId, time) {
  return `${medId}@${time}`
}

function isTaken(medId, time) {
  const day = state.log[todayKey()] || {}
  return Boolean(day[doseKey(medId, time)])
}

function markTaken(medId, time, taken = true) {
  const day = todayKey()
  state.log[day] = state.log[day] || {}
  if (taken) state.log[day][doseKey(medId, time)] = Date.now()
  else delete state.log[day][doseKey(medId, time)]
  saveLog()
  render()
  showToast(taken ? 'Listo, pastilla marcada' : 'Desmarcado')
}

function todaysDoses() {
  const items = []
  for (const med of state.meds) {
    for (const time of med.times) {
      items.push({
        id: doseKey(med.id, time),
        medId: med.id,
        name: med.name,
        dose: med.dose,
        time,
        taken: isTaken(med.id, time),
      })
    }
  }
  items.sort((a, b) => parseTime(a.time) - parseTime(b.time))
  return items
}

function isDueNow(time, now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes()
  const target = parseTime(time)
  return current >= target && current <= target + 30
}

function showToast(message) {
  const el = document.querySelector('.toast')
  if (!el) return
  el.textContent = message
  el.classList.add('show')
  clearTimeout(state.toastTimer)
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 2200)
}

function openSheet(name) {
  state.sheet = name
  if (name === 'add' && !state.draftTimes.length) state.draftTimes = ['08:00']
  render()
}

function resetDraft() {
  state.draftTimes = ['08:00']
  state.draftName = ''
  state.draftDose = ''
}

function closeSheet() {
  state.sheet = null
  render()
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast('Este navegador no soporta avisos')
    return
  }
  const permission = await Notification.requestPermission()
  if (permission === 'granted') {
    showToast('Avisos activados')
    checkReminders()
  } else {
    showToast('No se pudieron activar los avisos')
  }
}

function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_REMINDER',
      title,
      body,
      tag,
    })
    return
  }
  new Notification(title, { body, tag, icon: './icon-192.png' })
}

function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const day = todayKey(now)
  const notified = loadNotified()
  if (notified.day !== day) {
    notified.day = day
    notified.tags = {}
  }

  for (const dose of todaysDoses()) {
    if (dose.taken) continue
    const target = parseTime(dose.time)
    const tag = `${day}-${dose.id}`
    const due = current >= target && current <= target + 20
    if (due && !notified.tags[tag]) {
      notify(
        `Hora de ${dose.name}`,
        dose.dose ? `Tomá: ${dose.dose}` : 'Abrí Dosis y marcá como tomada',
        tag,
      )
      notified.tags[tag] = true
    }
  }
  saveNotified(notified)
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {})
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderDoseList() {
  const doses = todaysDoses()
  if (!doses.length) {
    return `
      <div class="empty">
        <strong>Todavía no hay pastillas</strong>
        Agregá tu primera dosis y te avisamos cuando toque tomarla.
      </div>
    `
  }

  return `
    <div class="dose-list">
      ${doses
        .map((dose) => {
          const due = !dose.taken && isDueNow(dose.time)
          return `
            <article class="dose ${dose.taken ? 'is-taken' : ''} ${due ? 'is-due' : ''}" data-id="${dose.id}">
              <div class="dose-time">
                <strong>${escapeHtml(dose.time)}</strong>
                <span>${periodLabel(dose.time)}</span>
              </div>
              <div class="dose-meta">
                <h3>${escapeHtml(dose.name)}</h3>
                <p>${dose.dose ? escapeHtml(dose.dose) : 'Sin dosis indicada'}${due ? ' · ahora' : ''}</p>
              </div>
              ${
                dose.taken
                  ? `<button class="undo-btn" data-action="undo" data-med="${dose.medId}" data-time="${dose.time}" aria-label="Deshacer">Hecho</button>`
                  : `<button class="take-btn" data-action="take" data-med="${dose.medId}" data-time="${dose.time}" aria-label="Marcar tomada">✓</button>`
              }
            </article>
          `
        })
        .join('')}
    </div>
  `
}

function renderMedsList() {
  if (!state.meds.length) {
    return `<div class="empty"><strong>Sin medicamentos</strong>Creá uno para empezar.</div>`
  }
  return `
    <div class="meds">
      ${state.meds
        .map(
          (med) => `
            <article class="med">
              <div>
                <h3>${escapeHtml(med.name)}</h3>
                <p>${med.dose ? escapeHtml(med.dose) + ' · ' : ''}${med.times.join(' · ')}</p>
              </div>
              <button class="delete-btn" data-action="delete-med" data-med="${med.id}">Borrar</button>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function renderAddSheet() {
  return `
    <div class="sheet-backdrop ${state.sheet === 'add' ? 'open' : ''}" data-action="close-sheet"></div>
    <aside class="sheet ${state.sheet === 'add' ? 'open' : ''}" aria-hidden="${state.sheet !== 'add'}">
      <div class="sheet-handle"></div>
      <h2>Nueva pastilla</h2>
      <p>Nombre, dosis y horarios. Se guarda en este celular.</p>
      <form id="add-form">
        <div class="field">
          <label for="med-name">Nombre</label>
          <input id="med-name" name="name" required maxlength="60" placeholder="Ej. Vitamina D" autocomplete="off" value="${escapeHtml(state.draftName)}" />
        </div>
        <div class="field">
          <label for="med-dose">Dosis (opcional)</label>
          <input id="med-dose" name="dose" maxlength="40" placeholder="Ej. 1 comprimido" autocomplete="off" value="${escapeHtml(state.draftDose)}" />
        </div>
        <div class="field">
          <label>Horarios</label>
          <div class="times-row" id="times-row">
            ${state.draftTimes
              .map(
                (time, index) => `
                  <span class="time-pill">
                    ${escapeHtml(time)}
                    <button type="button" data-action="remove-time" data-index="${index}" aria-label="Quitar horario">×</button>
                  </span>
                `,
              )
              .join('')}
          </div>
        </div>
        <div class="field">
          <label for="new-time">Agregar horario</label>
          <div class="add-time">
            <input id="new-time" type="time" value="20:00" />
            <button type="button" data-action="add-time">Sumar</button>
          </div>
        </div>
        <div class="sheet-actions">
          <button type="button" class="ghost" data-action="close-sheet">Cancelar</button>
          <button type="submit" class="primary">Guardar</button>
        </div>
      </form>
    </aside>
  `
}

function renderManageSheet() {
  return `
    <div class="sheet-backdrop ${state.sheet === 'manage' ? 'open' : ''}" data-action="close-sheet"></div>
    <aside class="sheet ${state.sheet === 'manage' ? 'open' : ''}" aria-hidden="${state.sheet !== 'manage'}">
      <div class="sheet-handle"></div>
      <h2>Tus pastillas</h2>
      <p>Administrá lo que tenés cargado o activá avisos.</p>
      ${renderMedsList()}
      <div class="sheet-actions">
        <button type="button" class="ghost" data-action="close-sheet">Cerrar</button>
        <button type="button" class="primary" data-action="enable-notifications">Activar avisos</button>
      </div>
    </aside>
  `
}

function render() {
  const pending = todaysDoses().filter((d) => !d.taken).length
  app.innerHTML = `
    <div class="atmosphere" aria-hidden="true"></div>
    <div class="shell">
      <header class="hero">
        <p class="brand">Dosis</p>
        <p class="tagline">Tu recordatorio diario de pastillas, simple y a mano.</p>
        <div class="date-chip">${formatDateLabel()}${pending ? ` · ${pending} pendientes` : ' · al día'}</div>
      </header>

      <h2 class="section-title">Hoy</h2>
      ${renderDoseList()}
    </div>

    <div class="dock">
      <button class="ghost" data-action="open-manage">Mis pastillas</button>
      <button class="primary" data-action="open-add">Agregar</button>
    </div>

    ${renderAddSheet()}
    ${renderManageSheet()}
    <div class="toast" role="status" aria-live="polite"></div>
  `

  bindEvents()
}

function bindEvents() {
  app.querySelectorAll('[data-action="open-add"]').forEach((el) =>
    el.addEventListener('click', () => {
      resetDraft()
      openSheet('add')
    }),
  )
  app.querySelectorAll('[data-action="open-manage"]').forEach((el) =>
    el.addEventListener('click', () => openSheet('manage')),
  )
  app.querySelectorAll('[data-action="close-sheet"]').forEach((el) =>
    el.addEventListener('click', () => closeSheet()),
  )
  app.querySelectorAll('[data-action="enable-notifications"]').forEach((el) =>
    el.addEventListener('click', () => enableNotifications()),
  )

  app.querySelectorAll('[data-action="take"]').forEach((el) =>
    el.addEventListener('click', () => markTaken(el.dataset.med, el.dataset.time, true)),
  )
  app.querySelectorAll('[data-action="undo"]').forEach((el) =>
    el.addEventListener('click', () => markTaken(el.dataset.med, el.dataset.time, false)),
  )
  app.querySelectorAll('[data-action="delete-med"]').forEach((el) =>
    el.addEventListener('click', () => {
      state.meds = state.meds.filter((m) => m.id !== el.dataset.med)
      saveMeds()
      render()
      showToast('Pastilla eliminada')
    }),
  )

  const nameInput = document.querySelector('#med-name')
  const doseInput = document.querySelector('#med-dose')
  nameInput?.addEventListener('input', () => {
    state.draftName = nameInput.value
  })
  doseInput?.addEventListener('input', () => {
    state.draftDose = doseInput.value
  })

  app.querySelectorAll('[data-action="add-time"]').forEach((el) =>
    el.addEventListener('click', () => {
      const input = document.querySelector('#new-time')
      const value = input?.value
      if (!value) return
      if (!state.draftTimes.includes(value)) {
        state.draftTimes.push(value)
        state.draftTimes.sort((a, b) => parseTime(a) - parseTime(b))
      }
      openSheet('add')
    }),
  )

  app.querySelectorAll('[data-action="remove-time"]').forEach((el) =>
    el.addEventListener('click', () => {
      const index = Number(el.dataset.index)
      state.draftTimes = state.draftTimes.filter((_, i) => i !== index)
      if (!state.draftTimes.length) state.draftTimes = ['08:00']
      openSheet('add')
    }),
  )

  const form = document.querySelector('#add-form')
  form?.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    const name = String(data.get('name') || '').trim()
    const dose = String(data.get('dose') || '').trim()
    if (!name || !state.draftTimes.length) return
    state.meds.push({
      id: uid(),
      name,
      dose,
      times: [...state.draftTimes],
      createdAt: Date.now(),
    })
    saveMeds()
    resetDraft()
    closeSheet()
    showToast('Pastilla guardada')
  })
}

registerServiceWorker()
render()
checkReminders()
setInterval(() => checkReminders(), 30000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    render()
    checkReminders()
  }
})
