const PRESETS = {
  classic: {
    label: "Classic 25",
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  },
  deep: {
    label: "Deep 50",
    pomodoroMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
  },
};

const COLOR_OPTIONS = [
  "#4c80ad",
  "#5f8ea2",
  "#6f7fa6",
  "#7aa383",
  "#9a8574",
  "#7d8db5",
];

const DEFAULT_COLORS = {
  work: "#4c80ad",
  shortBreak: "#5f8ea2",
  longBreak: "#6f7fa6",
};

const SESSION_LABELS = {
  pomodoro: "Pomodoro",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const SESSION_KEYS = Object.keys(SESSION_LABELS);
const STORAGE_KEY = "pomaxis-soft";

const elements = {
  body: document.body,
  presetTabs: document.querySelectorAll(".preset-tab"),
  sessionTabs: document.querySelectorAll(".session-tab"),
  timerLabel: document.getElementById("timer-label"),
  timerDisplay: document.getElementById("timer-display"),
  timerSubtext: document.getElementById("timer-subtext"),
  progressBar: document.getElementById("progress-bar"),
  startPause: document.getElementById("start-pause"),
  reset: document.getElementById("reset"),
  whiteNoiseToggle: document.getElementById("white-noise-toggle"),
  toggleSettings: document.getElementById("toggle-settings"),
  settingsModal: document.getElementById("settings-modal"),
  settingsPanel: document.getElementById("settings-panel"),
  closeSettings: document.getElementById("close-settings"),
  saveSettings: document.getElementById("save-settings"),
  resetColors: document.getElementById("reset-colors"),
  pomodoroMinutes: document.getElementById("pomodoro-minutes"),
  shortBreakMinutes: document.getElementById("short-break-minutes"),
  longBreakMinutes: document.getElementById("long-break-minutes"),
  workSwatches: document.getElementById("work-swatches"),
  shortSwatches: document.getElementById("short-swatches"),
  longSwatches: document.getElementById("long-swatches"),
  taskForm: document.getElementById("task-form"),
  taskInput: document.getElementById("task-input"),
  taskList: document.getElementById("task-list"),
  taskTemplate: document.getElementById("task-template"),
  taskProgress: document.getElementById("task-progress"),
  goalForm: document.getElementById("goal-form"),
  goalInput: document.getElementById("goal-input"),
  goalProgressRing: document.getElementById("goal-progress-ring"),
  goalProgressCount: document.getElementById("goal-progress-count"),
  goalSummary: document.getElementById("goal-summary"),
  dailySummary: document.getElementById("daily-summary"),
  statusBadge: document.getElementById("status-badge"),
  toast: document.getElementById("toast"),
  confettiLayer: document.getElementById("confetti-layer"),
};

let state = {
  preset: "classic",
  session: "pomodoro",
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  timeLeft: 25 * 60,
  totalTime: 25 * 60,
  running: false,
  activeTimerSession: null,
  lastTickAt: null,
  sessionStates: {},
  pomodorosToday: 0,
  goalPomodoros: 4,
  statsDate: getTodayKey(),
  tasks: [],
  settingsOpen: false,
  colors: { ...DEFAULT_COLORS },
};

let draftColors = { ...DEFAULT_COLORS };
let timerInterval = null;
let toastTimeout = null;
let clickSound = null;
let whiteNoisePlaying = false;
let whiteNoiseContext = null;
let whiteNoiseNode = null;
let whiteNoiseGainNode = null;
let whiteNoiseFilterNodes = [];

initialize();

function initialize() {
  loadState();
  normalizeState();
  bindEvents();
  renderSwatches();
  render();
  registerServiceWorker();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    state = { ...state, ...JSON.parse(raw) };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeState() {
  if (!PRESETS[state.preset] && state.preset !== "custom") {
    state.preset = "classic";
  }

  if (!SESSION_LABELS[state.session]) {
    state.session = "pomodoro";
  }

  if (state.statsDate !== getTodayKey()) {
    state.statsDate = getTodayKey();
    state.pomodorosToday = 0;
  }

  state.pomodoroMinutes = clampMinutes(state.pomodoroMinutes, 25, 180);
  state.shortBreakMinutes = clampMinutes(state.shortBreakMinutes, 5, 60);
  state.longBreakMinutes = clampMinutes(state.longBreakMinutes, 15, 90);
  state.goalPomodoros = clampMinutes(state.goalPomodoros, 4, 24);
  normalizeSessionStates();
  reconcilePersistedTimer();
  syncSelectedSessionState();
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.settingsOpen = Boolean(state.settingsOpen);
  state.colors = normalizeColors(state.colors);
  draftColors = { ...state.colors };

  applyBackgroundMood();
  updateDurationInputs();
  updateGoalInput();
  persistState();
}

function bindEvents() {
  document.addEventListener("click", handleGlobalClick);
  elements.startPause.addEventListener("click", toggleTimer);
  elements.reset.addEventListener("click", resetTimer);
  elements.whiteNoiseToggle.addEventListener("click", toggleWhiteNoise);
  elements.toggleSettings.addEventListener("click", toggleSettingsPanel);
  elements.closeSettings.addEventListener("click", closeSettingsModal);
  elements.saveSettings.addEventListener("click", saveCustomizations);
  elements.resetColors.addEventListener("click", resetColorMood);
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.goalForm.addEventListener("submit", handleGoalSubmit);
  elements.settingsModal.addEventListener("click", handleModalClick);
  document.addEventListener("keydown", handleKeydown);

  elements.presetTabs.forEach((button) => {
    button.addEventListener("click", () => applyPreset(button.dataset.preset));
  });

  elements.sessionTabs.forEach((button) => {
    button.addEventListener("click", () =>
      switchSession(button.dataset.session),
    );
  });

  bindTapAnimation(document.querySelectorAll("button"));
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getSessionDuration(session) {
  if (session === "pomodoro") {
    return state.pomodoroMinutes * 60;
  }

  if (session === "shortBreak") {
    return state.shortBreakMinutes * 60;
  }

  return state.longBreakMinutes * 60;
}

function toggleTimer() {
  syncRunningTimer();

  if (isSessionRunning(state.session)) {
    pauseTimer();
    return;
  }

  state.activeTimerSession = state.session;
  state.lastTickAt = Date.now();
  clearInterval(timerInterval);
  timerInterval = window.setInterval(tick, 1000);
  render();
}

function pauseTimer() {
  syncRunningTimer();
  state.activeTimerSession = null;
  state.lastTickAt = null;
  clearInterval(timerInterval);
  render();
}

function tick() {
  syncRunningTimer();
  render();
}

function resetTimer() {
  if (isSessionRunning(state.session)) {
    state.activeTimerSession = null;
    state.lastTickAt = null;
    clearInterval(timerInterval);
  }

  resetSessionState(state.session);
  syncSelectedSessionState();
  showToast(`${SESSION_LABELS[state.session]} reset.`);
  render();
}

function applyPreset(presetKey) {
  if (!PRESETS[presetKey]) {
    return;
  }

  const preset = PRESETS[presetKey];
  pauseTimer();
  state.preset = presetKey;
  state.pomodoroMinutes = preset.pomodoroMinutes;
  state.shortBreakMinutes = preset.shortBreakMinutes;
  state.longBreakMinutes = preset.longBreakMinutes;
  state.session = "pomodoro";
  resetAllSessionStates();
  syncSelectedSessionState();
  updateDurationInputs();
  pulseTimer();
  showToast(`${preset.label} preset applied.`);
  render();
}

function switchSession(session) {
  if (!SESSION_LABELS[session]) {
    return;
  }

  syncRunningTimer();
  state.session = session;
  syncSelectedSessionState();
  pulseTimer();

  render();
}

function toggleSettingsPanel() {
  if (state.settingsOpen) {
    closeSettingsModal();
    return;
  }

  state.settingsOpen = true;
  draftColors = { ...state.colors };
  renderSettings();
  renderSwatches();
  persistState();
}

function saveCustomizations() {
  const nextPomodoroMinutes = clampMinutes(
    elements.pomodoroMinutes.value,
    state.pomodoroMinutes,
    180,
  );
  const nextShortBreakMinutes = clampMinutes(
    elements.shortBreakMinutes.value,
    state.shortBreakMinutes,
    60,
  );
  const nextLongBreakMinutes = clampMinutes(
    elements.longBreakMinutes.value,
    state.longBreakMinutes,
    90,
  );
  const durationsChanged =
    nextPomodoroMinutes !== state.pomodoroMinutes ||
    nextShortBreakMinutes !== state.shortBreakMinutes ||
    nextLongBreakMinutes !== state.longBreakMinutes;

  if (durationsChanged) {
    pauseTimer();
  }

  state.pomodoroMinutes = nextPomodoroMinutes;
  state.shortBreakMinutes = nextShortBreakMinutes;
  state.longBreakMinutes = nextLongBreakMinutes;
  state.colors = normalizeColors(draftColors);
  state.preset = "custom";
  if (durationsChanged) {
    resetAllSessionStates();
    syncSelectedSessionState();
  }
  updateDurationInputs();
  if (durationsChanged) {
    pulseTimer();
  }
  showToast("Custom settings saved.");
  state.settingsOpen = false;
  render();
}

function resetColorMood() {
  draftColors = { ...DEFAULT_COLORS };
  state.colors = { ...DEFAULT_COLORS };
  renderSwatches();
  applyBackgroundMood();
  persistState();
  showToast("Background colors reset.");
}

function handleSessionComplete(
  completedSession = state.activeTimerSession,
  completedAt = Date.now(),
) {
  clearInterval(timerInterval);
  state.activeTimerSession = null;
  state.lastTickAt = null;

  if (!SESSION_LABELS[completedSession]) {
    syncSelectedSessionState();
    render();
    return;
  }

  resetSessionState(completedSession);

  if (completedSession === "pomodoro") {
    incrementPomodoroCount(completedAt);
    celebrate();
    playNotificationTone();
    state.session = state.pomodorosToday % 4 === 0 ? "longBreak" : "shortBreak";
    showToast("Pomodoro complete. Break time.");
  } else {
    state.session = "pomodoro";
    showToast("Break complete. Back to focus.");
  }

  syncSelectedSessionState();
  pulseTimer();
  render();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const value = elements.taskInput.value.trim();
  if (!value) {
    return;
  }

  state.tasks.unshift({
    id:
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: value,
    completed: false,
  });

  elements.taskInput.value = "";
  renderTasks();
  renderTaskProgress();
  persistState();
}

function handleGoalSubmit(event) {
  event.preventDefault();
  state.goalPomodoros = clampMinutes(
    elements.goalInput.value,
    state.goalPomodoros,
    24,
  );
  updateGoalInput();
  renderGoal();
  persistState();
  showToast("Daily goal updated.");
}

function toggleTask(taskId) {
  state.tasks = state.tasks.map((task) =>
    task.id === taskId ? { ...task, completed: !task.completed } : task,
  );
  renderTasks();
  renderTaskProgress();
  persistState();
}

function removeTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  renderTasks();
  renderTaskProgress();
  persistState();
}

function render() {
  applyBackgroundMood();
  renderPresetTabs();
  renderSessionTabs();
  renderTimer();
  renderWhiteNoiseToggle();
  renderGoal();
  renderSettings();
  renderTasks();
  renderTaskProgress();
  renderStats();
  persistState();
}

function renderGoal() {
  const progress = Math.min(1, state.pomodorosToday / state.goalPomodoros);
  const circumference = 289;
  const offset = circumference * (1 - progress);

  elements.goalProgressRing.style.strokeDashoffset = `${offset}`;
  elements.goalProgressCount.textContent = `${state.pomodorosToday}/${state.goalPomodoros}`;
  elements.goalSummary.textContent =
    state.pomodorosToday >= state.goalPomodoros
      ? `Goal reached. You've completed ${state.pomodorosToday} pomodoros today.`
      : `Complete ${state.goalPomodoros} pomodoros today.`;
}

function applyBackgroundMood() {
  elements.body.style.setProperty("--bg-work", state.colors.work);
  elements.body.style.setProperty("--bg-short", state.colors.shortBreak);
  elements.body.style.setProperty("--bg-long", state.colors.longBreak);

  if (state.session === "shortBreak") {
    elements.body.style.setProperty("--bg-active", state.colors.shortBreak);
    return;
  }

  if (state.session === "longBreak") {
    elements.body.style.setProperty("--bg-active", state.colors.longBreak);
    return;
  }

  elements.body.style.setProperty("--bg-active", state.colors.work);
}

function renderPresetTabs() {
  elements.presetTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.preset);
  });
}

function renderSessionTabs() {
  elements.sessionTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.session === state.session);
  });
}

function renderTimer() {
  syncSelectedSessionState();
  const progress =
    state.totalTime === 0
      ? 0
      : ((state.totalTime - state.timeLeft) / state.totalTime) * 100;

  elements.timerLabel.textContent = SESSION_LABELS[state.session];
  elements.timerDisplay.textContent = formatTime(state.timeLeft);
  elements.timerSubtext.textContent = getSubtext();
  elements.progressBar.style.width = `${progress}%`;
  elements.startPause.textContent = isSessionRunning(state.session)
    ? "Pause"
    : "Start";
  elements.statusBadge.textContent = getStatusLabel();
  document.title = `${formatTime(state.timeLeft)} · ${SESSION_LABELS[state.session]} · Pomaxis`;
}

function renderWhiteNoiseToggle() {
  elements.whiteNoiseToggle.textContent = "Air";
  elements.whiteNoiseToggle.setAttribute(
    "aria-pressed",
    String(whiteNoisePlaying),
  );
  const label = whiteNoisePlaying
    ? "Turn focus noise off"
    : "Turn focus noise on";
  elements.whiteNoiseToggle.setAttribute("aria-label", label);
  elements.whiteNoiseToggle.title = label;
}

function renderSettings() {
  elements.settingsModal.classList.toggle("hidden", !state.settingsOpen);
  elements.settingsModal.classList.toggle("open", state.settingsOpen);
  elements.settingsModal.setAttribute(
    "aria-hidden",
    String(!state.settingsOpen),
  );
  elements.toggleSettings.setAttribute(
    "aria-expanded",
    String(state.settingsOpen),
  );
}

function closeSettingsModal() {
  state.settingsOpen = false;
  renderSettings();
  persistState();
}

function handleModalClick(event) {
  const closeTrigger = event.target.closest("[data-close-modal='true']");
  if (closeTrigger) {
    closeSettingsModal();
  }
}

function handleGlobalClick(event) {
  const button = event.target.closest("button");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  playClickSound();
}

function handleKeydown(event) {
  if (event.key === "Escape" && state.settingsOpen) {
    closeSettingsModal();
    return;
  }

  const isEnter = event.key === "Enter";
  const isSpace = event.key === " " || event.code === "Space";

  if ((!isEnter && !isSpace) || event.repeat || state.settingsOpen) {
    return;
  }

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) ||
      target.closest("form"))
  ) {
    return;
  }

  event.preventDefault();

  if (isSpace) {
    toggleTimer();
    return;
  }

  if (!hasActiveTimer()) {
    toggleTimer();
  }
}

function renderSwatches() {
  renderSwatchGroup(elements.workSwatches, "work");
  renderSwatchGroup(elements.shortSwatches, "shortBreak");
  renderSwatchGroup(elements.longSwatches, "longBreak");
}

function renderSwatchGroup(container, key) {
  container.innerHTML = "";

  COLOR_OPTIONS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-swatch";
    button.style.background = color;
    button.setAttribute("aria-label", `${key} color ${color}`);
    button.classList.toggle("selected", draftColors[key] === color);
    button.addEventListener("click", () => {
      animateTap(button);
      draftColors[key] = color;
      renderSwatches();
    });
    container.appendChild(button);
  });
}

function renderTasks() {
  elements.taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "py-4 text-sm text-white/55";
    empty.textContent = "No tasks yet.";
    elements.taskList.appendChild(empty);
    return;
  }

  state.tasks.forEach((task) => {
    const node =
      elements.taskTemplate.content.firstElementChild.cloneNode(true);
    const text = node.querySelector(".task-text");
    const check = node.querySelector(".task-check");
    const remove = node.querySelector(".task-remove");

    text.textContent = task.text;
    node.classList.toggle("completed", task.completed);
    check.addEventListener("click", () => toggleTask(task.id));
    remove.addEventListener("click", () => removeTask(task.id));
    elements.taskList.appendChild(node);
  });
}

function renderTaskProgress() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  elements.taskProgress.textContent = `${completed}/${total} completed`;
}

function renderStats() {
  elements.dailySummary.textContent = `${state.pomodorosToday} pomodoro${
    state.pomodorosToday === 1 ? "" : "s"
  } today`;
}

function updateDurationInputs() {
  elements.pomodoroMinutes.value = state.pomodoroMinutes;
  elements.shortBreakMinutes.value = state.shortBreakMinutes;
  elements.longBreakMinutes.value = state.longBreakMinutes;
}

function updateGoalInput() {
  elements.goalInput.value = state.goalPomodoros;
}

function pulseTimer() {
  elements.timerDisplay.classList.remove("switching");
  void elements.timerDisplay.offsetWidth;
  elements.timerDisplay.classList.add("switching");

  window.setTimeout(() => {
    elements.timerDisplay.classList.remove("switching");
  }, 220);
}

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.classList.add("toast-visible");

  toastTimeout = window.setTimeout(() => {
    elements.toast.classList.remove("toast-visible");
  }, 2200);
}

function bindTapAnimation(buttons) {
  buttons.forEach((button) => {
    button.addEventListener("click", () => animateTap(button));
  });
}

function animateTap(button) {
  button.classList.remove("tap-pop");
  void button.offsetWidth;
  button.classList.add("tap-pop");
}

function getClickSound() {
  if (!clickSound) {
    clickSound = new Audio("./click_sound.mp3");
    clickSound.preload = "auto";
  }

  return clickSound;
}

function playClickSound() {
  const audio = getClickSound();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function getWhiteNoiseContext() {
  if (!whiteNoiseContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    whiteNoiseContext = new AudioContextClass();
  }

  return whiteNoiseContext;
}

function createProceduralWhiteNoiseNode(context) {
  if (typeof context.createScriptProcessor !== "function") {
    throw new Error("Continuous noise generation unsupported");
  }

  const processor = context.createScriptProcessor(2048, 1, 1);
  let lastSample = 0;
  processor.onaudioprocess = (event) => {
    const output = event.outputBuffer.getChannelData(0);
    for (let index = 0; index < output.length; index += 1) {
      const white = Math.random() * 2 - 1;
      lastSample = (lastSample + 0.02 * white) / 1.02;
      output[index] = lastSample * 3.2;
    }
  };
  return processor;
}

function createAirplaneNoiseFilters(context) {
  const highpass = context.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 45;
  highpass.Q.value = 0.7;

  const lowshelf = context.createBiquadFilter();
  lowshelf.type = "lowshelf";
  lowshelf.frequency.value = 180;
  lowshelf.gain.value = 8;

  const lowpass = context.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 900;
  lowpass.Q.value = 0.8;

  const highshelf = context.createBiquadFilter();
  highshelf.type = "highshelf";
  highshelf.frequency.value = 1400;
  highshelf.gain.value = -10;

  return [highpass, lowshelf, lowpass, highshelf];
}

function stopWhiteNoiseLoop() {
  if (whiteNoiseNode) {
    if ("onaudioprocess" in whiteNoiseNode) {
      whiteNoiseNode.onaudioprocess = null;
    }

    if (typeof whiteNoiseNode.stop === "function") {
      try {
        whiteNoiseNode.stop();
      } catch {}
    }

    whiteNoiseNode.disconnect();
    whiteNoiseNode = null;
  }

  if (whiteNoiseGainNode) {
    whiteNoiseGainNode.disconnect();
    whiteNoiseGainNode = null;
  }

  whiteNoiseFilterNodes.forEach((node) => node.disconnect());
  whiteNoiseFilterNodes = [];

  whiteNoisePlaying = false;
  renderWhiteNoiseToggle();
}

async function startWhiteNoiseLoop() {
  stopWhiteNoiseLoop();

  const context = getWhiteNoiseContext();
  if (!context) {
    throw new Error("AudioContext unsupported");
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  const gain = context.createGain();
  gain.gain.value = 0.12;

  const noiseNode = createProceduralWhiteNoiseNode(context);
  const filters = createAirplaneNoiseFilters(context);

  noiseNode.connect(filters[0]);
  filters[0].connect(filters[1]);
  filters[1].connect(filters[2]);
  filters[2].connect(filters[3]);
  filters[3].connect(gain);
  gain.connect(context.destination);

  if (typeof noiseNode.start === "function") {
    noiseNode.start();
  }

  whiteNoiseNode = noiseNode;
  whiteNoiseGainNode = gain;
  whiteNoiseFilterNodes = filters;
  whiteNoisePlaying = true;
  renderWhiteNoiseToggle();
}

async function toggleWhiteNoise() {
  if (whiteNoisePlaying) {
    stopWhiteNoiseLoop();
    showToast("White noise off.");
    return;
  }

  try {
    await startWhiteNoiseLoop();
    showToast("White noise on.");
  } catch {
    stopWhiteNoiseLoop();
    showToast("White noise couldn't start.");
  }
}

function celebrate() {
  const colors = ["#ffffff", "#dfeaf7", "#bfd2e8", "#f6fbff"];
  elements.confettiLayer.innerHTML = "";

  for (let index = 0; index < 20; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDuration = `${2.6 + Math.random() * 0.9}s`;
    piece.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
    elements.confettiLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    elements.confettiLayer.innerHTML = "";
  }, 3000);
}

function playNotificationTone() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const now = audioContext.currentTime;
  const tones = [523.25, 659.25];

  tones.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const start = now + index * 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    oscillator.start(start);
    oscillator.stop(start + 0.26);
  });

  window.setTimeout(() => {
    audioContext.close().catch(() => {});
  }, 700);
}

function getSubtext() {
  if (isSessionRunning(state.session)) {
    return `${SESSION_LABELS[state.session]} in progress`;
  }

  if (hasActiveTimer()) {
    return `${SESSION_LABELS[state.activeTimerSession]} continues in the background`;
  }

  if (state.session === "pomodoro") {
    if (state.preset === "deep") {
      return "Deep focus block ready.";
    }

    if (state.preset === "custom") {
      return "Custom focus block ready.";
    }

    return "Classic focus block ready.";
  }

  if (state.session === "shortBreak") {
    return "Short reset, softer pace.";
  }

  return "Long reset, cozy drift.";
}

function normalizeColors(colors) {
  return {
    work: normalizeColor(colors && colors.work, DEFAULT_COLORS.work),
    shortBreak: normalizeColor(
      colors && colors.shortBreak,
      DEFAULT_COLORS.shortBreak,
    ),
    longBreak: normalizeColor(
      colors && colors.longBreak,
      DEFAULT_COLORS.longBreak,
    ),
  };
}

function normalizeColor(value, fallback) {
  return COLOR_OPTIONS.includes(value) ? value : fallback;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function clampSeconds(value, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.max(0, Math.min(fallback, Math.round(numeric)));
}

function clampMinutes(value, fallback, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(numeric)));
}

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function normalizeSessionStates() {
  const totalBySession = getAllSessionDurations();
  const nextSessionStates = {};
  const hasLegacyTimerState =
    !state.sessionStates || Object.keys(state.sessionStates).length === 0;

  SESSION_KEYS.forEach((session) => {
    const existing = state.sessionStates && state.sessionStates[session];
    const totalTime = totalBySession[session];
    let timeLeft = clampSeconds(existing && existing.timeLeft, totalTime);

    if (hasLegacyTimerState && session === state.session) {
      timeLeft = clampSeconds(state.timeLeft, totalTime);
    }

    nextSessionStates[session] = {
      totalTime,
      timeLeft,
    };
  });

  state.sessionStates = nextSessionStates;

  if (!SESSION_LABELS[state.activeTimerSession]) {
    state.activeTimerSession = null;
  }

  state.lastTickAt = Number.isFinite(Number(state.lastTickAt))
    ? Number(state.lastTickAt)
    : null;
}

function reconcilePersistedTimer() {
  if (!hasActiveTimer()) {
    return;
  }

  syncRunningTimer();

  if (hasActiveTimer()) {
    clearInterval(timerInterval);
    timerInterval = window.setInterval(tick, 1000);
  }
}

function syncRunningTimer(now = Date.now()) {
  if (!hasActiveTimer()) {
    syncSelectedSessionState();
    return;
  }

  const elapsedSeconds = Math.floor((now - state.lastTickAt) / 1000);
  if (elapsedSeconds <= 0) {
    syncSelectedSessionState();
    return;
  }

  const sessionState = state.sessionStates[state.activeTimerSession];
  if (!sessionState) {
    state.activeTimerSession = null;
    state.lastTickAt = null;
    clearInterval(timerInterval);
    syncSelectedSessionState();
    persistState();
    return;
  }

  if (elapsedSeconds >= sessionState.timeLeft) {
    const completedAt = state.lastTickAt + sessionState.timeLeft * 1000;
    sessionState.timeLeft = 0;
    handleSessionComplete(state.activeTimerSession, completedAt);
    return;
  }

  sessionState.timeLeft -= elapsedSeconds;
  state.lastTickAt += elapsedSeconds * 1000;
  syncSelectedSessionState();
  persistState();
}

function syncSelectedSessionState() {
  const sessionState = state.sessionStates[state.session];
  const totalTime = getSessionDuration(state.session);

  if (!sessionState) {
    state.totalTime = totalTime;
    state.timeLeft = totalTime;
  } else {
    state.totalTime = sessionState.totalTime;
    state.timeLeft = sessionState.timeLeft;
  }

  state.running = isSessionRunning(state.session);
}

function resetAllSessionStates() {
  state.activeTimerSession = null;
  state.lastTickAt = null;
  clearInterval(timerInterval);
  state.sessionStates = {};

  SESSION_KEYS.forEach((session) => {
    resetSessionState(session);
  });
}

function resetSessionState(session) {
  state.sessionStates[session] = {
    totalTime: getSessionDuration(session),
    timeLeft: getSessionDuration(session),
  };
}

function getAllSessionDurations() {
  return {
    pomodoro: getSessionDuration("pomodoro"),
    shortBreak: getSessionDuration("shortBreak"),
    longBreak: getSessionDuration("longBreak"),
  };
}

function hasActiveTimer() {
  return Boolean(state.activeTimerSession && state.lastTickAt);
}

function isSessionRunning(session) {
  return hasActiveTimer() && state.activeTimerSession === session;
}

function getStatusLabel() {
  if (isSessionRunning(state.session)) {
    return "Running";
  }

  if (hasActiveTimer()) {
    return `${SESSION_LABELS[state.activeTimerSession]} Running`;
  }

  return "Idle";
}

function incrementPomodoroCount(completedAt) {
  const completionDay = new Date(completedAt).toLocaleDateString("en-CA");
  const today = getTodayKey();

  if (completionDay !== today) {
    state.statsDate = today;
    state.pomodorosToday = 0;
    return;
  }

  if (state.statsDate !== today) {
    state.statsDate = today;
    state.pomodorosToday = 0;
  }

  state.pomodorosToday += 1;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
