import './style.css'

const STORAGE_KEY = 'dosis.meds.v1'
const LOG_KEY = 'dosis.log.v1'
const NOTIFIED_KEY = 'dosis.notified.v1'

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
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
  draftTimes: [],
  draftDays: [],
  draftName: '',
  draftDose: '',
  draftHour: '',
  draftMinute: '',
  sheet: null,
  toastTimer: null,
  mounted: false,
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

function medDays(med) {
  if (Array.isArray(med.days) && med.days.length) return med.days
  return ALL_DAYS
}

function isActiveToday(med, date = new Date()) {
  return medDays(med).includes(date.getDay())
}

function isWholeWeek(days) {
  return ALL_DAYS.every((day) => days.includes(day))
}

function daysLabel(days) {
  const sorted = [...days].sort((a, b) => a - b)
  if (isWholeWeek(sorted)) return 'Toda la semana'
  return sorted.map((day) => DAY_SHORT[day]).join(' · ')
}

function todaysDoses() {
  const items = []
  for (const med of state.meds) {
    if (!isActiveToday(med)) continue
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

function pad2(value) {
  return String(value).padStart(2, '0')
}

function buildTimeValue(hour, minute) {
  if (hour === '' || minute === '') return null
  const h = Number(hour)
  const m = Number(minute)
  if (!Number.isInteger(h) || h < 0 || h > 23) return null
  if (!Number.isInteger(m) || m < 0 || m > 59) return null
  return `${pad2(h)}:${pad2(m)}`
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function showToast(message) {
  const el = app.querySelector('.toast')
  if (!el) return
  el.textContent = message
  el.classList.add('show')
  clearTimeout(state.toastTimer)
  state.toastTimer = setTimeout(() => el.classList.remove('show'), 2200)
}

function resetDraft() {
  state.draftTimes = []
  state.draftDays = []
  state.draftName = ''
  state.draftDose = ''
  state.draftHour = ''
  state.draftMinute = ''
}

function toggleTaken(medId, time) {
  const day = todayKey()
  const key = doseKey(medId, time)
  state.log[day] = state.log[day] || {}
  if (state.log[day][key]) delete state.log[day][key]
  else state.log[day][key] = Date.now()
  saveLog()
  // El estado de la pastilla debe refrescar la lista de hoy
  updateHome()
}

function hourOptionsHtml() {
  return Array.from({ length: 24 }, (_, hour) => `<option value="${hour}">${hour}</option>`).join('')
}

function minuteOptionsHtml() {
  return Array.from({ length: 60 }, (_, minute) => `<option value="${minute}">${pad2(minute)}</option>`).join('')
}

function doseCardHtml(dose) {
  const due = !dose.taken && isDueNow(dose.time)
  return `
    <article
      class="dose ${dose.taken ? 'is-taken' : ''} ${due ? 'is-due' : ''}"
      data-action="toggle-dose"
      data-med="${dose.medId}"
      data-time="${dose.time}"
      role="button"
      tabindex="0"
      aria-pressed="${dose.taken}"
    >
      <div class="dose-time">
        <strong>${escapeHtml(dose.time)}</strong>
        <span>${periodLabel(dose.time)}</span>
      </div>
      <div class="dose-meta">
        <h3>${escapeHtml(dose.name)}</h3>
        <p>${dose.dose ? escapeHtml(dose.dose) : 'Sin dosis indicada'}${due ? ' · ahora' : ''}${dose.taken ? ' · tomada' : ''}</p>
      </div>
      <span class="dose-check" aria-hidden="true">${dose.taken ? '✓' : ''}</span>
    </article>
  `
}

function doseListHtml() {
  const doses = todaysDoses()
  if (!doses.length) {
    return `
      <div class="empty">
        <strong>Todavía no hay pastillas</strong>
        Agregá tu primera dosis y te avisamos cuando toque tomarla.
      </div>
    `
  }
  return `<div class="dose-list">${doses.map(doseCardHtml).join('')}</div>`
}

function medsListHtml() {
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
                <p class="med-days">${escapeHtml(daysLabel(medDays(med)))}</p>
              </div>
              <button class="delete-btn" type="button" data-action="delete-med" data-med="${med.id}">Borrar</button>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function timesListHtml() {
  if (!state.draftTimes.length) {
    return `<p class="times-empty">Todavía no agregaste un horario.</p>`
  }
  return `
    <div class="times-row">
      ${state.draftTimes
        .map(
          (time, index) => `
            <span class="time-pill">
              <strong>${escapeHtml(time)}</strong>
              <span>${periodLabel(time)}</span>
              <button type="button" data-action="remove-time" data-index="${index}" aria-label="Quitar horario">×</button>
            </span>
          `,
        )
        .join('')}
    </div>
  `
}

function updateHome() {
  const pending = todaysDoses().filter((d) => !d.taken).length
  const chip = app.querySelector('[data-ref="date-chip"]')
  const list = app.querySelector('[data-ref="dose-list"]')
  if (chip) chip.textContent = `${formatDateLabel()}${pending ? ` · ${pending} pendientes` : ' · al día'}`
  if (list) list.innerHTML = doseListHtml()
}

function patchDoseCard(medId, time) {
  const dose = todaysDoses().find((item) => item.medId === medId && item.time === time)
  const current = app.querySelector(
    `[data-action="toggle-dose"][data-med="${CSS.escape(medId)}"][data-time="${CSS.escape(time)}"]`,
  )
  if (!dose || !current) {
    updateHome()
    return
  }
  const pending = todaysDoses().filter((d) => !d.taken).length
  const chip = app.querySelector('[data-ref="date-chip"]')
  if (chip) chip.textContent = `${formatDateLabel()}${pending ? ` · ${pending} pendientes` : ' · al día'}`
  const wrap = document.createElement('div')
  wrap.innerHTML = doseCardHtml(dose)
  const next = wrap.firstElementChild
  next.style.animation = 'none'
  current.replaceWith(next)
}

function updateDaysUI() {
  const wholeWeek = isWholeWeek(state.draftDays)
  const weekBtn = app.querySelector('[data-action="toggle-whole-week"]')
  if (weekBtn) {
    weekBtn.classList.toggle('is-on', wholeWeek)
    weekBtn.setAttribute('aria-pressed', String(wholeWeek))
  }
  app.querySelectorAll('[data-action="toggle-day"]').forEach((btn) => {
    const day = Number(btn.dataset.day)
    const on = state.draftDays.includes(day)
    btn.classList.toggle('is-on', on)
    btn.setAttribute('aria-pressed', String(on))
  })
}

function updateTimesUI() {
  const box = app.querySelector('[data-ref="times-box"]')
  if (box) box.innerHTML = timesListHtml()
}

function updateManageList() {
  const box = app.querySelector('[data-ref="meds-box"]')
  if (box) box.innerHTML = medsListHtml()
}

function syncDraftInputs() {
  const nameInput = app.querySelector('#med-name')
  const doseInput = app.querySelector('#med-dose')
  const hourSelect = app.querySelector('#draft-hour')
  const minuteSelect = app.querySelector('#draft-minute')
  if (nameInput) nameInput.value = state.draftName
  if (doseInput) doseInput.value = state.draftDose
  if (hourSelect) hourSelect.value = state.draftHour === '' ? '' : String(state.draftHour)
  if (minuteSelect) minuteSelect.value = state.draftMinute === '' ? '' : String(state.draftMinute)
}

function setSheet(name) {
  state.sheet = name
  const addOpen = name === 'add'
  const manageOpen = name === 'manage'

  app.querySelector('[data-sheet="add-backdrop"]')?.classList.toggle('open', addOpen)
  app.querySelector('[data-sheet="add"]')?.classList.toggle('open', addOpen)
  app.querySelector('[data-sheet="add"]')?.setAttribute('aria-hidden', String(!addOpen))

  app.querySelector('[data-sheet="manage-backdrop"]')?.classList.toggle('open', manageOpen)
  app.querySelector('[data-sheet="manage"]')?.classList.toggle('open', manageOpen)
  app.querySelector('[data-sheet="manage"]')?.setAttribute('aria-hidden', String(!manageOpen))
}

function openAdd() {
  resetDraft()
  syncDraftInputs()
  updateDaysUI()
  updateTimesUI()
  setSheet('add')
}

function openManage() {
  updateManageList()
  setSheet('manage')
}

function closeSheet() {
  setSheet(null)
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

function mount() {
  const pending = todaysDoses().filter((d) => !d.taken).length
  app.innerHTML = `
    <div class="atmosphere" aria-hidden="true"></div>
    <div class="shell">
      <header class="hero">
        <p class="brand">Dosis</p>
        <p class="tagline">Tu recordatorio diario de pastillas, simple y a mano.</p>
        <div class="date-chip" data-ref="date-chip">${formatDateLabel()}${pending ? ` · ${pending} pendientes` : ' · al día'}</div>
        <div class="hero-actions">
          <button class="ghost" type="button" data-action="open-manage">Mis pastillas</button>
          <button class="primary" type="button" data-action="open-add">Agregar</button>
        </div>
      </header>

      <h2 class="section-title">Hoy</h2>
      <div data-ref="dose-list">${doseListHtml()}</div>
    </div>

    <div class="sheet-backdrop" data-sheet="add-backdrop" data-action="close-sheet"></div>
    <aside class="sheet" data-sheet="add" aria-hidden="true">
      <div class="sheet-handle"></div>
      <h2>Nueva pastilla</h2>
      <p>Nombre, días y horarios. Se guarda en este celular.</p>
      <form id="add-form">
        <div class="field">
          <label for="med-name">Nombre</label>
          <input id="med-name" name="name" required maxlength="60" placeholder="Ej. Vitamina D" autocomplete="off" />
        </div>
        <div class="field">
          <label for="med-dose">Dosis (opcional)</label>
          <input id="med-dose" name="dose" maxlength="40" placeholder="Ej. 1 comprimido" autocomplete="off" />
        </div>
        <div class="field">
          <label>Días</label>
          <button type="button" class="week-toggle" data-action="toggle-whole-week" aria-pressed="false">Toda la semana</button>
          <div class="days-row" role="group" aria-label="Días de la semana">
            ${ALL_DAYS.map(
              (day) => `
                <button type="button" class="day-chip" data-action="toggle-day" data-day="${day}" aria-pressed="false">${DAY_SHORT[day]}</button>
              `,
            ).join('')}
          </div>
        </div>
        <div class="field">
          <label>Horarios</label>
          <div data-ref="times-box">${timesListHtml()}</div>
        </div>
        <div class="field">
          <label>Elegí un horario (0 a 23 h)</label>
          <div class="time-picker" role="group" aria-label="Selector de horario">
            <label class="time-picker-part">
              <span>Hora</span>
              <select id="draft-hour" aria-label="Hora">
                <option value="" selected disabled>Elegir</option>
                ${hourOptionsHtml()}
              </select>
            </label>
            <span class="time-picker-sep" aria-hidden="true">:</span>
            <label class="time-picker-part">
              <span>Minutos</span>
              <select id="draft-minute" aria-label="Minutos">
                <option value="" selected disabled>Elegir</option>
                ${minuteOptionsHtml()}
              </select>
            </label>
          </div>
          <button type="button" class="add-time-btn" data-action="add-time">Agregar horario</button>
        </div>
        <div class="sheet-actions">
          <button type="button" class="ghost" data-action="close-sheet">Cancelar</button>
          <button type="submit" class="primary">Guardar</button>
        </div>
      </form>
    </aside>

    <div class="sheet-backdrop" data-sheet="manage-backdrop" data-action="close-sheet"></div>
    <aside class="sheet" data-sheet="manage" aria-hidden="true">
      <div class="sheet-handle"></div>
      <h2>Tus pastillas</h2>
      <p>Administrá lo que tenés cargado o activá avisos.</p>
      <div data-ref="meds-box">${medsListHtml()}</div>
      <div class="sheet-actions">
        <button type="button" class="ghost" data-action="close-sheet">Cerrar</button>
        <button type="button" class="primary" data-action="enable-notifications">Activar avisos</button>
      </div>
    </aside>

    <div class="toast" role="status" aria-live="polite"></div>
  `

  if (!state.mounted) {
    bindGlobalEvents()
    state.mounted = true
  }
}

function bindGlobalEvents() {
  app.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]')
    if (!target || !app.contains(target)) return
    const action = target.dataset.action

    if (action === 'open-add') {
      openAdd()
      return
    }
    if (action === 'open-manage') {
      openManage()
      return
    }
    if (action === 'close-sheet') {
      closeSheet()
      return
    }
    if (action === 'enable-notifications') {
      enableNotifications()
      return
    }
    if (action === 'toggle-dose') {
      toggleTaken(target.dataset.med, target.dataset.time)
      return
    }
    if (action === 'delete-med') {
      state.meds = state.meds.filter((m) => m.id !== target.dataset.med)
      saveMeds()
      updateManageList()
      updateHome()
      showToast('Pastilla eliminada')
      return
    }
    if (action === 'toggle-whole-week') {
      state.draftDays = isWholeWeek(state.draftDays) ? [] : [...ALL_DAYS]
      updateDaysUI()
      return
    }
    if (action === 'toggle-day') {
      const day = Number(target.dataset.day)
      if (state.draftDays.includes(day)) {
        state.draftDays = state.draftDays.filter((d) => d !== day)
      } else {
        state.draftDays = [...state.draftDays, day].sort((a, b) => a - b)
      }
      updateDaysUI()
      return
    }
    if (action === 'add-time') {
      const value = buildTimeValue(state.draftHour, state.draftMinute)
      if (!value) {
        showToast('Elegí hora y minutos')
        return
      }
      if (state.draftTimes.includes(value)) {
        showToast('Ese horario ya está')
        return
      }
      state.draftTimes.push(value)
      state.draftTimes.sort((a, b) => parseTime(a) - parseTime(b))
      state.draftHour = ''
      state.draftMinute = ''
      syncDraftInputs()
      updateTimesUI()
      return
    }
    if (action === 'remove-time') {
      const index = Number(target.dataset.index)
      state.draftTimes = state.draftTimes.filter((_, i) => i !== index)
      updateTimesUI()
    }
  })

  app.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target.closest('[data-action="toggle-dose"]')
    if (!target) return
    event.preventDefault()
    toggleTaken(target.dataset.med, target.dataset.time)
  })

  app.addEventListener('input', (event) => {
    if (event.target.id === 'med-name') state.draftName = event.target.value
    if (event.target.id === 'med-dose') state.draftDose = event.target.value
  })

  app.addEventListener('change', (event) => {
    if (event.target.id === 'draft-hour') state.draftHour = event.target.value
    if (event.target.id === 'draft-minute') state.draftMinute = event.target.value
  })

  app.addEventListener('submit', (event) => {
    if (event.target.id !== 'add-form') return
    event.preventDefault()
    const name = state.draftName.trim()
    const dose = state.draftDose.trim()
    if (!name) {
      showToast('Escribí el nombre')
      return
    }
    if (!state.draftDays.length) {
      showToast('Elegí al menos un día')
      return
    }
    if (!state.draftTimes.length) {
      showToast('Agregá al menos un horario')
      return
    }
    state.meds.push({
      id: uid(),
      name,
      dose,
      times: [...state.draftTimes],
      days: [...state.draftDays],
      createdAt: Date.now(),
    })
    saveMeds()
    resetDraft()
    syncDraftInputs()
    updateDaysUI()
    updateTimesUI()
    closeSheet()
    updateHome()
    showToast('Pastilla guardada')
  })
}

registerServiceWorker()
mount()
checkReminders()
setInterval(() => checkReminders(), 30000)

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateHome()
    checkReminders()
  }
})
