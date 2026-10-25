/**
 * Główna logika aplikacji Planera Tygodnia
 */
document.addEventListener('DOMContentLoaded', () => {
  const DAY_NAMES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

  const defaultCategories = [
    { id: 'cat-p1-d', name: 'Praca 1 - Dzień', color: '#2563eb' },
    { id: 'cat-p1-n', name: 'Praca 1 - Noc', color: '#1e3a8a' },
    { id: 'cat-p2-d', name: 'Praca 2 - Dzień (Bursztyn)', color: '#f59e0b' },
    { id: 'cat-pk',   name: 'Projekt kompetencyjny', color: '#10b981' },
    { id: 'cat-mi',   name: 'Marketing internetowy', color: '#8b5cf6' },
    { id: 'cat-sem',  name: 'Seminarium dyplomowe', color: '#06b6d4' }
  ];

  let events = [];
  let categories = JSON.parse(localStorage.getItem('my_weekly_categories')) || defaultCategories;
  let currentMonday = getMonday(new Date());

  // Elementy DOM
  const grid = document.getElementById('grid');
  const syncStatus = document.getElementById('syncStatus');
  const currentWeekRange = document.getElementById('currentWeekRange');

  // Modale
  const authModal = document.getElementById('authModal');
  const exportModal = document.getElementById('exportModal');
  const eventModal = document.getElementById('eventModal');
  const categoriesModal = document.getElementById('categoriesModal');
  const summaryModal = document.getElementById('summaryModal');

  // Formularze
  const authForm = document.getElementById('authForm');
  const eventForm = document.getElementById('eventForm');
  const newCategoryForm = document.getElementById('newCategoryForm');

  // Inicjalizacja nasłuchiwaczy zdarzeń
  initEventListeners();
  loadData();

  function initEventListeners() {
    document.getElementById('prevWeekBtn').addEventListener('click', () => changeWeek(-1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    document.getElementById('nextWeekBtn').addEventListener('click', () => changeWeek(1));

    document.getElementById('openAuthBtn').addEventListener('click', openAuthModal);
    document.getElementById('closeAuthBtn').addEventListener('click', closeAuthModal);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    authForm.addEventListener('submit', handleAuthSubmit);

    document.getElementById('openExportBtn').addEventListener('click', openExportModal);
    document.getElementById('closeExportBtn').addEventListener('click', closeExportModal);
    document.getElementById('startExportBtn').addEventListener('click', executeExportPNG);

    document.getElementById('openAddModalBtn').addEventListener('click', openAddModal);
    document.getElementById('closeEventModalBtn').addEventListener('click', closeEventModal);
    document.getElementById('deleteEventBtn').addEventListener('click', deleteCurrentEvent);
    eventForm.addEventListener('submit', handleEventSubmit);

    document.getElementById('openCategoriesBtn').addEventListener('click', openCategoriesModal);
    document.getElementById('closeCategoriesBtn').addEventListener('click', closeCategoriesModal);
    newCategoryForm.addEventListener('submit', handleNewCategory);

    document.getElementById('openSummaryBtn').addEventListener('click', openSummaryModal);
    document.getElementById('closeSummaryBtn').addEventListener('click', closeSummaryModal);
    document.getElementById('summaryPrevBtn').addEventListener('click', () => shiftSummaryMonth(-1));
    document.getElementById('summaryNextBtn').addEventListener('click', () => shiftSummaryMonth(1));
    document.getElementById('summaryMonth').addEventListener('change', applySummaryMonth);
    document.getElementById('summaryFrom').addEventListener('change', handleSummaryRangeChange);
    document.getElementById('summaryTo').addEventListener('change', handleSummaryRangeChange);
  }

  // --- Funkcje pomocnicze daty i czasu ---

  function formatDateISO(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  function getDaysOfWeek(monday) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      days.push({
        name: DAY_NAMES[i],
        iso: formatDateISO(nextDay),
        dateStr: String(nextDay.getDate()).padStart(2, '0') + '.' + String(nextDay.getMonth() + 1).padStart(2, '0'),
        isWeekend: (i >= 5)
      });
    }
    return days;
  }

  function changeWeek(direction) {
    currentMonday.setDate(currentMonday.getDate() + (direction * 7));
    render();
  }

  function goToToday() {
    currentMonday = getMonday(new Date());
    render();
  }

  function normalizeEvents(rawList) {
    return rawList.map(e => {
      if (!e.startDate) {
        return {
          id: e.id,
          title: e.title,
          info: e.info || '',
          categoryId: e.categoryId,
          startDate: e.date,
          startTime: e.start,
          endDate: e.date,
          endTime: e.end,
          color: e.color
        };
      }
      return e;
    });
  }

  // --- Synchronizacja z API ---

  async function loadData() {
    if (!AppConfig.hasCredentials()) {
      syncStatus.className = 'sync-status offline';
      syncStatus.innerText = '🔒 Kliknij: Klucze / Zaloguj';
      openAuthModal();
      return;
    }

    try {
      syncStatus.className = 'sync-status syncing';
      syncStatus.innerText = 'Pobieranie...';

      const res = await fetch(AppConfig.getApiUrl(), {
        headers: { 'X-Master-Key': AppConfig.getApiKey() }
      });

      if (!res.ok) throw new Error('Błąd autoryzacji lub sieci');

      const data = await res.json();
      let loaded = [];
      if (data.record && data.record.events) {
        loaded = data.record.events;
        if (data.record.categories) categories = data.record.categories;
      } else if (Array.isArray(data.record)) {
        loaded = data.record;
      }

      events = normalizeEvents(loaded);
      localStorage.setItem('my_weekly_events_cloud', JSON.stringify(events));
      localStorage.setItem('my_weekly_categories', JSON.stringify(categories));

      syncStatus.className = 'sync-status online';
      syncStatus.innerText = '☁️ Chmura aktywna';
      render();
    } catch (err) {
      console.error('Błąd API:', err);
      syncStatus.className = 'sync-status offline';
      syncStatus.innerText = 'Błąd połączenia / API';
      events = normalizeEvents(JSON.parse(localStorage.getItem('my_weekly_events_cloud')) || []);
      render();
    }
  }

  async function saveData() {
    localStorage.setItem('my_weekly_events_cloud', JSON.stringify(events));
    localStorage.setItem('my_weekly_categories', JSON.stringify(categories));

    if (!AppConfig.hasCredentials()) {
      openAuthModal();
      return;
    }

    try {
      syncStatus.className = 'sync-status syncing';
      syncStatus.innerText = 'Zapisywanie...';

      const res = await fetch(AppConfig.getApiUrl(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': AppConfig.getApiKey()
        },
        body: JSON.stringify({ events, categories })
      });

      if (!res.ok) throw new Error('Błąd zapisu');

      syncStatus.className = 'sync-status online';
      syncStatus.innerText = '☁️ Chmura: Zapisano';
    } catch (err) {
      console.error('Błąd zapisu:', err);
      syncStatus.className = 'sync-status offline';
      syncStatus.innerText = 'Błąd zapisu w chmurze!';
    }
  }

  // --- Przetwarzanie wycinków zdarzeń wielodniowych i kolizji ---

  function getSlicesForDay(dayISO) {
    const slices = [];
    events.forEach(evt => {
      if (dayISO >= evt.startDate && dayISO <= evt.endDate) {
        let start = "00:00";
        let end = "24:00";

        if (dayISO === evt.startDate) start = evt.startTime;
        if (dayISO === evt.endDate) end = evt.endTime;

        slices.push({
          id: evt.id,
          title: evt.title,
          info: evt.info,
          categoryId: evt.categoryId,
          color: evt.color,
          start,
          end,
          isMultiDay: (evt.startDate !== evt.endDate),
          rawEvent: evt
        });
      }
    });
    return slices;
  }

  function processDayEventOverlaps(dayEvents) {
    if (!dayEvents || dayEvents.length === 0) return [];

    const parsed = dayEvents.map(e => {
      const startM = timeToMinutes(e.start === "24:00" ? "23:59" : e.start);
      const endM = e.end === "24:00" ? 1440 : timeToMinutes(e.end);
      return {
        ...e,
        startM,
        endM,
        duration: Math.max(endM - startM, 15),
        isSmallerOverlap: false,
        hasConflict: false
      };
    });

    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        const a = parsed[i];
        const b = parsed[j];
        const overlaps = Math.max(a.startM, b.startM) < Math.min(a.endM, b.endM);

        if (overlaps) {
          a.hasConflict = true;
          b.hasConflict = true;
          if (a.duration < b.duration) {
            a.isSmallerOverlap = true;
          } else if (b.duration < a.duration) {
            b.isSmallerOverlap = true;
          } else {
            b.isSmallerOverlap = true;
          }
        }
      }
    }
    return parsed;
  }

  // --- Renderowanie widoku ---

  function updateCategoryDropdown() {
    const select = document.getElementById('eventCategorySelect');
    select.innerHTML = '';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.innerText = cat.name;
      select.appendChild(opt);
    });
  }

  function buildGridHTML(mondayDate, isForExport = false) {
    const daysOfWeek = getDaysOfWeek(mondayDate);
    const todayISO = formatDateISO(new Date());

    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'schedule-grid';
    if (isForExport) {
      gridWrapper.style.minWidth = '100%';
      gridWrapper.style.width = '100%';
    }

    const corner = document.createElement('div');
    corner.className = 'time-header-corner';
    corner.innerText = 'Dzień';
    gridWrapper.appendChild(corner);

    for (let h = 0; h < 24; h++) {
      const isNight = (h < 6 || h >= 22);
      const th = document.createElement('div');
      th.className = `time-header ${isNight ? 'night-header' : ''}`;
      th.innerText = (h < 10 ? '0' + h : h) + ':00' + (isNight ? ' 🌙' : '');
      gridWrapper.appendChild(th);
    }

    daysOfWeek.forEach(day => {
      const isToday = (day.iso === todayISO);

      const label = document.createElement('div');
      label.className = `day-label ${day.isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}`;
      label.innerHTML = `
        <span class="day-name">${day.name}</span>
        <span class="day-date">${day.dateStr}</span>
        ${day.isWeekend && !isToday ? '<span class="weekend-badge">Weekend</span>' : ''}
        ${isToday ? '<span class="today-badge">Dzisiaj</span>' : ''}
      `;
      gridWrapper.appendChild(label);

      const track = document.createElement('div');
      track.className = `day-track ${day.isWeekend ? 'is-weekend' : ''} ${isToday ? 'is-today' : ''}`;

      const trackGrid = document.createElement('div');
      trackGrid.className = 'track-grid';
      for (let h = 0; h < 24; h++) {
        const cell = document.createElement('div');
        const isNight = (h < 6 || h >= 22);
        cell.className = `grid-cell ${isNight ? 'cell-night' : 'cell-day'}`;
        trackGrid.appendChild(cell);
      }
      track.appendChild(trackGrid);

      const rawDaySlices = getSlicesForDay(day.iso);
      const dayEvents = processDayEventOverlaps(rawDaySlices);

      dayEvents.forEach(evt => {
        const leftPercent = (evt.startM / 1440) * 100;
        const widthPercent = (evt.duration / 1440) * 100;

        const cat = categories.find(c => c.id === evt.categoryId);
        const eventColor = cat ? cat.color : (evt.color || '#3b82f6');

        const el = document.createElement('div');
        const overlapClass = evt.isSmallerOverlap ? 'event-inset' : 'event-base';

        el.className = `event ${overlapClass}`;
        el.style.backgroundColor = eventColor;
        el.style.left = `${leftPercent}%`;
        el.style.width = `${widthPercent}%`;
        el.style.zIndex = evt.isSmallerOverlap ? '15' : '5';

        el.title = `${evt.hasConflict ? '[KOLIZJA] ' : ''}${evt.title} (${evt.start} – ${evt.end})\nCałość: ${evt.rawEvent.startDate} ${evt.rawEvent.startTime} do ${evt.rawEvent.endDate} ${evt.rawEvent.endTime}\n${evt.info || ''}`;

        el.innerHTML = `
          <div class="event-title">
            ${evt.hasConflict && evt.isSmallerOverlap ? '⚠️ ' : ''}${evt.isMultiDay ? '↔ ' : ''}${evt.title}
          </div>
          <div class="event-info">${evt.start}–${evt.end} ${evt.info ? '• ' + evt.info : ''}</div>
        `;

        if (!isForExport) {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(evt.id);
          });
        }

        track.appendChild(el);
      });

      gridWrapper.appendChild(track);
    });

    return gridWrapper;
  }

  function render() {
    grid.innerHTML = '';
    const daysOfWeek = getDaysOfWeek(currentMonday);
    currentWeekRange.innerText = `Tydzień: ${daysOfWeek[0].dateStr} – ${daysOfWeek[6].dateStr}`;

    updateCategoryDropdown();

    const renderedGrid = buildGridHTML(currentMonday, false);
    while (renderedGrid.children.length > 0) {
      grid.appendChild(renderedGrid.children[0]);
    }
  }

  // --- Obsługa Eksportu PNG ---

  function openExportModal() {
    document.getElementById('exportTargetDate').value = formatDateISO(currentMonday);
    exportModal.style.display = 'flex';
  }

  function closeExportModal() {
    exportModal.style.display = 'none';
  }

  async function executeExportPNG() {
    const dateVal = document.getElementById('exportTargetDate').value;
    if (!dateVal) {
      alert('Wybierz datę.');
      return;
    }

    const targetMonday = getMonday(new Date(dateVal + 'T00:00:00'));
    const daysOfWeek = getDaysOfWeek(targetMonday);
    const weekLabel = `${daysOfWeek[0].dateStr}_${daysOfWeek[6].dateStr}`;

    const btn = document.getElementById('startExportBtn');
    btn.innerText = '⏳ Generowanie PNG...';
    btn.disabled = true;

    const container = document.getElementById('exportOffscreenContainer');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1f314d; padding-bottom: 12px;">
        <div style="display:flex; align-items:center; gap: 12px;">
          <div style="background:#10b981; color:#fff; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">✓</div>
          <div>
            <h2 style="font-size: 20px; color: #f1f5f9; margin: 0;">Planer Tygodnia (24h)</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 3px 0 0 0;">Tydzień: ${daysOfWeek[0].dateStr} – ${daysOfWeek[6].dateStr}</p>
          </div>
        </div>
        <div style="display:flex; gap: 14px; align-items:center; flex-wrap: wrap;">
          ${categories.map(c => `
            <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:#cbd5e1;">
              <div style="width:12px; height:12px; border-radius:3px; background:${c.color};"></div>
              <span>${c.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const scheduleCard = document.createElement('div');
    scheduleCard.className = 'schedule-wrapper';
    scheduleCard.style.border = '2px solid #334155';
    scheduleCard.style.overflow = 'visible';

    const exportGrid = buildGridHTML(targetMonday, true);
    scheduleCard.appendChild(exportGrid);
    container.appendChild(scheduleCard);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0b131f',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `Plan_Tygodnia_${weekLabel}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      closeExportModal();
    } catch (err) {
      console.error('Błąd eksportu PNG:', err);
      alert('Wystąpił błąd podczas generowania pliku PNG.');
    } finally {
      container.innerHTML = '';
      btn.innerText = '📸 Pobierz plik PNG';
      btn.disabled = false;
    }
  }

  // --- Obsługa Zdarzeń (CRUD) ---

  function openAddModal() {
    const todayISO = formatDateISO(new Date());
    document.getElementById('eventModalTitle').innerText = 'Dodaj wpis';
    document.getElementById('eventId').value = '';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventInfo').value = '';
    document.getElementById('eventStartDate').value = todayISO;
    document.getElementById('eventStartTime').value = '19:00';
    document.getElementById('eventEndDate').value = todayISO;
    document.getElementById('eventEndTime').value = '23:00';

    if (categories.length > 0) {
      document.getElementById('eventCategorySelect').value = categories[0].id;
    }

    document.getElementById('deleteEventBtn').style.display = 'none';
    eventModal.style.display = 'flex';
  }

  function openEditModal(id) {
    const evt = events.find(e => e.id === id);
    if (!evt) return;

    document.getElementById('eventModalTitle').innerText = 'Edytuj wpis';
    document.getElementById('eventId').value = evt.id;
    document.getElementById('eventTitle').value = evt.title;
    document.getElementById('eventInfo').value = evt.info || '';
    document.getElementById('eventStartDate').value = evt.startDate;
    document.getElementById('eventStartTime').value = evt.startTime;
    document.getElementById('eventEndDate').value = evt.endDate;
    document.getElementById('eventEndTime').value = evt.endTime;

    if (evt.categoryId) {
      document.getElementById('eventCategorySelect').value = evt.categoryId;
    }

    document.getElementById('deleteEventBtn').style.display = 'block';
    eventModal.style.display = 'flex';
  }

  function closeEventModal() {
    eventModal.style.display = 'none';
  }

  async function handleEventSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value.trim();
    const info = document.getElementById('eventInfo').value.trim();
    const startDate = document.getElementById('eventStartDate').value;
    const startTime = document.getElementById('eventStartTime').value;
    const endDate = document.getElementById('eventEndDate').value;
    const endTime = document.getElementById('eventEndTime').value;
    const categoryId = document.getElementById('eventCategorySelect').value;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      alert('Data i godzina zakończenia musi być późniejsza niż rozpoczęcia.');
      return;
    }

    if (id) {
      const idx = events.findIndex(item => item.id === id);
      if (idx !== -1) {
        events[idx] = { id, title, info, startDate, startTime, endDate, endTime, categoryId };
      }
    } else {
      events.push({
        id: 'evt-' + Date.now(),
        title, info, startDate, startTime, endDate, endTime, categoryId
      });
    }

    render();
    closeEventModal();
    await saveData();
  }

  async function deleteCurrentEvent() {
    const id = document.getElementById('eventId').value;
    if (confirm('Czy na pewno chcesz usunąć to zdarzenie?')) {
      events = events.filter(e => e.id !== id);
      render();
      closeEventModal();
      await saveData();
    }
  }

  // --- Obsługa Kategorii ---

  function openCategoriesModal() {
    renderCategoriesList();
    categoriesModal.style.display = 'flex';
  }

  function closeCategoriesModal() {
    categoriesModal.style.display = 'none';
    render();
  }

  function renderCategoriesList() {
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';

    categories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <div class="category-pill">
          <div class="color-dot" style="background-color: ${cat.color};"></div>
          <span>${cat.name}</span>
        </div>
        <button type="button" class="btn btn-danger" style="padding: 3px 8px; font-size: 11px;">Usuń</button>
      `;

      item.querySelector('button').addEventListener('click', () => deleteCategory(cat.id));
      container.appendChild(item);
    });
  }

  async function handleNewCategory(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newCategoryName');
    const colorInput = document.getElementById('newCategoryColor');

    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) return;

    categories.push({ id: 'cat-' + Date.now(), name, color });
    nameInput.value = '';
    renderCategoriesList();
    await saveData();
  }

  async function deleteCategory(id) {
    if (categories.length <= 1) {
      alert('Musi pozostać przynajmniej jedna kategoria.');
      return;
    }
    if (confirm('Czy na pewno chcesz usunąć tę kategorię?')) {
      categories = categories.filter(c => c.id !== id);
      renderCategoriesList();
      await saveData();
    }
  }

  // --- Podsumowanie godzin (miesiąc lub dowolny zakres od–do) ---

  function openSummaryModal() {
    // Domyślnie miesiąc, w którym wypada czwartek oglądanego tygodnia
    const ref = new Date(currentMonday);
    ref.setDate(ref.getDate() + 3);
    document.getElementById('summaryMonth').value = formatDateISO(ref).slice(0, 7);
    applySummaryMonth();
    summaryModal.style.display = 'flex';
  }

  // Ustawia pola Od/Do na pierwszy i ostatni dzień wybranego miesiąca
  function applySummaryMonth() {
    const value = document.getElementById('summaryMonth').value;
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    document.getElementById('summaryFrom').value = formatDateISO(new Date(y, m - 1, 1));
    document.getElementById('summaryTo').value = formatDateISO(new Date(y, m, 0));
    renderMonthSummary();
  }

  // Ręczna zmiana zakresu – pole miesiąca przestaje odpowiadać zakresowi
  function handleSummaryRangeChange() {
    const from = document.getElementById('summaryFrom').value;
    const to = document.getElementById('summaryTo').value;
    const monthInput = document.getElementById('summaryMonth');
    const isFullMonth = from && to && from.endsWith('-01') &&
      to === formatDateISO(new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0));
    monthInput.value = isFullMonth ? from.slice(0, 7) : '';
    renderMonthSummary();
  }

  function closeSummaryModal() {
    summaryModal.style.display = 'none';
  }

  function shiftSummaryMonth(direction) {
    const input = document.getElementById('summaryMonth');
    const base = input.value || document.getElementById('summaryFrom').value.slice(0, 7) || formatDateISO(new Date()).slice(0, 7);
    const [y, m] = base.split('-').map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    input.value = formatDateISO(d).slice(0, 7);
    applySummaryMonth();
  }

  function formatHours(ms) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  // Sumuje czas wpisów (przyciętych do granic zakresu) per kategoria i per nazwa wpisu
  function computeRangeSummary(rangeStart, rangeEnd) {
    const byCategory = {};
    let total = 0;

    events.forEach(evt => {
      const start = new Date(`${evt.startDate}T${evt.startTime}`);
      const end = new Date(`${evt.endDate}T${evt.endTime}`);
      const ms = Math.min(end, rangeEnd) - Math.max(start, rangeStart);
      if (!(ms > 0)) return;

      const catId = evt.categoryId || 'none';
      if (!byCategory[catId]) byCategory[catId] = { ms: 0, count: 0, titles: {} };
      const bucket = byCategory[catId];
      bucket.ms += ms;
      bucket.count += 1;
      bucket.titles[evt.title] = (bucket.titles[evt.title] || 0) + ms;
      total += ms;
    });

    return { byCategory, total };
  }

  function renderMonthSummary() {
    const container = document.getElementById('summaryContainer');
    const from = document.getElementById('summaryFrom').value;
    const to = document.getElementById('summaryTo').value;
    container.innerHTML = '';
    if (!from || !to) return;

    if (to < from) {
      container.innerHTML = '<p class="modal-desc">Data „Do” musi być taka sama lub późniejsza niż „Od”.</p>';
      return;
    }

    // Zakres obejmuje cały dzień „Do” – koniec to północ dnia następnego
    const rangeStart = new Date(`${from}T00:00`);
    const rangeEnd = new Date(`${to}T00:00`);
    rangeEnd.setDate(rangeEnd.getDate() + 1);

    const { byCategory, total } = computeRangeSummary(rangeStart, rangeEnd);
    const catIds = Object.keys(byCategory).sort((a, b) => byCategory[b].ms - byCategory[a].ms);

    if (catIds.length === 0) {
      container.innerHTML = '<p class="modal-desc">Brak wpisów w wybranym okresie.</p>';
      return;
    }

    catIds.forEach(catId => {
      const data = byCategory[catId];
      const cat = categories.find(c => c.id === catId);
      const name = cat ? cat.name : 'Bez kategorii';
      const color = cat ? cat.color : '#64748b';

      const titles = Object.entries(data.titles).sort((a, b) => b[1] - a[1]);
      const item = document.createElement('div');
      item.className = 'summary-item';
      item.innerHTML = `
        <div class="summary-row">
          <div class="category-pill">
            <div class="color-dot" style="background-color: ${color};"></div>
            <span>${name}</span>
          </div>
          <span class="summary-hours">${formatHours(data.ms)}</span>
        </div>
        ${titles.length > 1 ? titles.map(([title, ms]) => `
          <div class="summary-row summary-sub">
            <span>${title}</span>
            <span>${formatHours(ms)}</span>
          </div>
        `).join('') : ''}
      `;
      container.appendChild(item);
    });

    const totalEl = document.createElement('div');
    totalEl.className = 'summary-row summary-total';
    totalEl.innerHTML = `<span>Razem</span><span class="summary-hours">${formatHours(total)}</span>`;
    container.appendChild(totalEl);
  }

  // --- Obsługa Uwierzytelniania ---

  function openAuthModal() {
    document.getElementById('authBinId').value = AppConfig.getBinId();
    document.getElementById('authApiKey').value = AppConfig.getApiKey();
    authModal.style.display = 'flex';
  }

  function closeAuthModal() {
    authModal.style.display = 'none';
  }

  function handleAuthSubmit(e) {
    e.preventDefault();
    const binId = document.getElementById('authBinId').value.trim();
    const apiKey = document.getElementById('authApiKey').value.trim();

    if (!binId || !apiKey) {
      alert('Podaj Login (Bin ID) oraz Hasło (API Master Key).');
      return;
    }

    AppConfig.setCredentials(binId, apiKey);
    closeAuthModal();
    loadData();
  }

  function handleLogout() {
    if (confirm('Czy na pewno chcesz usunąć zapisane klucze z tej przeglądarki?')) {
      AppConfig.clearCredentials();
      document.getElementById('authBinId').value = '';
      document.getElementById('authApiKey').value = '';
      syncStatus.className = 'sync-status offline';
      syncStatus.innerText = '🔒 Wymagane zalogowanie';
      closeAuthModal();
    }
  }
});