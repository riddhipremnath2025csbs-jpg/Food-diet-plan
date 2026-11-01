"use strict";

const STORAGE_KEY = "formFuelDailyDemoV1";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const fallbackMeals = [
  { type: "Breakfast", name: "Oats with banana and yogurt", calories: 390, ingredients: ["Rolled oats", "Bananas", "Plain yogurt", "Cinnamon"] },
  { type: "Lunch", name: "Lentil and roasted vegetable bowl", calories: 520, ingredients: ["Lentils", "Brown rice", "Carrots", "Spinach", "Olive oil"] },
  { type: "Dinner", name: "Herbed salmon with potatoes", calories: 610, ingredients: ["Salmon", "Potatoes", "Green beans", "Lemon", "Dill"] },
  { type: "Snack", name: "Apple with peanut butter", calories: 210, ingredients: ["Apples", "Peanut butter"] }
];

let profile = null;
let meals = [];
let workouts = [];
let logItems = loadLogs();
let toastTimer;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadLogs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && item.date && item.type !== "weight") : [];
  } catch {
    return [];
  }
}

function saveLogs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logItems.filter((item) => item.type !== "weight")));
  } catch {
    showToast("Browser storage is unavailable. This session may not persist.");
  }
}

async function requestApi(path, data) {
  const options = data ? {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: new URLSearchParams(data)
  } : {};
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The server could not complete the request.");
  return result;
}

function showMessage(id, text, isError = false) {
  const element = document.getElementById(id);
  element.textContent = text;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", !isError && Boolean(text));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function todayLogs() {
  return logItems.filter((item) => item.date === localDateKey());
}

function formatNumber(number) {
  return Math.round(number).toLocaleString();
}

function renderDashboard() {
  const daily = todayLogs();
  const calories = daily.reduce((total, item) => total + (item.type === "meal" ? Number(item.calories) : 0), 0);
  const water = daily.reduce((total, item) => total + (item.type === "water" ? Number(item.amount) : 0), 0);
  const completed = workouts.filter((workout) => workout.completed).length;
  const target = profile ? Number(profile.calories) : 0;
  document.getElementById("caloriesValue").textContent = formatNumber(calories);
  document.getElementById("calorieTarget").textContent = target ? `${formatNumber(target)} kcal` : "Set a profile";
  document.getElementById("calorieProgress").style.width = `${target ? Math.min(100, calories / target * 100) : 0}%`;
  document.getElementById("waterValue").textContent = formatNumber(water);
  document.getElementById("waterTarget").textContent = `${formatNumber(water)} ml logged`;
  document.getElementById("waterProgress").style.width = `${Math.min(100, water / 2000 * 100)}%`;
  document.getElementById("workoutValue").textContent = `${completed} / ${workouts.length}`;
  document.getElementById("workoutProgress").style.width = `${workouts.length ? completed / workouts.length * 100 : 0}%`;
  document.getElementById("progressWorkoutCount").textContent = `${completed} / ${workouts.length}`;
  document.getElementById("progressMealCount").textContent = daily.filter((item) => item.type === "meal").length;
  renderActivity(daily);
  renderChart();
}

function renderProfile() {
  if (!profile) return;
  ["age", "height", "weight", "activity", "diet", "goal"].forEach((key) => {
    const field = document.getElementById(key);
    if (profile[key] !== undefined) field.value = profile[key];
  });
  document.getElementById("weightEntry").value = profile.weight;
  document.getElementById("weightValue").textContent = Number(profile.weight).toFixed(1);
  document.getElementById("weightNote").textContent = "Current profile weight";
  document.getElementById("bmiValue").textContent = Number(profile.bmi).toFixed(1);
  document.getElementById("bmiNote").textContent = "Estimate based on profile";
  document.getElementById("resultBmi").textContent = Number(profile.bmi).toFixed(1);
  document.getElementById("resultCalories").textContent = `${formatNumber(profile.calories)} kcal/day`;
}

function renderActivity(items) {
  const list = document.getElementById("activityList");
  if (!items.length) {
    list.innerHTML = '<li class="empty-state">Your entries will appear here.</li>';
    return;
  }
  list.replaceChildren(...items.slice().reverse().map((item) => {
    const row = document.createElement("li");
    const label = document.createElement("strong");
    const meta = document.createElement("span");
    label.textContent = item.type === "meal" ? item.name : `${item.amount} ml water`;
    meta.className = "activity-meta";
    meta.textContent = item.type === "meal" ? `${formatNumber(Number(item.calories))} kcal` : new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    row.append(label, meta);
    return row;
  }));
}

function renderChart() {
  const chart = document.getElementById("weeklyChart");
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const totals = dates.map((date) => logItems.filter((item) => item.date === localDateKey(date) && item.type === "meal").reduce((sum, item) => sum + Number(item.calories), 0));
  const highest = Math.max(...totals, 1);
  chart.replaceChildren(...dates.map((date, index) => {
    const column = document.createElement("div");
    const wrap = document.createElement("div");
    const bar = document.createElement("span");
    const label = document.createElement("span");
    column.className = "chart-column";
    wrap.className = "chart-bar-wrap";
    bar.className = `chart-bar${index === 6 ? " today" : ""}`;
    bar.style.height = `${totals[index] ? Math.max(4, totals[index] / highest * 100) : 3}%`;
    bar.title = `${DAY_NAMES[date.getDay()]}: ${formatNumber(totals[index])} kcal`;
    label.className = "chart-label";
    label.textContent = DAY_NAMES[date.getDay()];
    wrap.append(bar);
    column.append(wrap, label);
    return column;
  }));
}

function renderWorkouts() {
  const container = document.getElementById("workoutList");
  container.replaceChildren(...workouts.map((workout, index) => {
    const card = document.createElement("article");
    const day = document.createElement("div");
    const heading = document.createElement("h3");
    const description = document.createElement("p");
    const button = document.createElement("button");
    card.className = `workout-card${workout.completed ? " completed" : ""}`;
    day.className = "workout-day";
    day.innerHTML = `<span>${escapeHtml(workout.day)}</span><span>${escapeHtml(workout.focus)}</span>`;
    heading.textContent = workout.name;
    description.textContent = workout.exercises;
    button.className = "button outline-button";
    button.type = "button";
    button.textContent = workout.completed ? "Completed" : "Mark complete";
    button.addEventListener("click", () => toggleWorkout(index));
    card.append(day, heading, description, button);
    return card;
  }));
}

function renderMeals() {
  const container = document.getElementById("mealPlan");
  container.replaceChildren(...meals.map((meal, index) => {
    const row = document.createElement("article");
    const type = document.createElement("span");
    const detail = document.createElement("div");
    const name = document.createElement("strong");
    const ingredients = document.createElement("span");
    const controls = document.createElement("div");
    const calories = document.createElement("span");
    const replace = document.createElement("button");
    const record = document.createElement("button");
    row.className = "meal-row";
    type.className = "meal-type";
    type.textContent = meal.type;
    detail.className = "meal-detail";
    name.textContent = meal.name;
    ingredients.textContent = meal.ingredients.join(" / ");
    detail.append(name, ingredients);
    controls.className = "meal-controls";
    calories.className = "meal-calories";
    calories.textContent = `${formatNumber(meal.calories)} kcal`;
    replace.className = "button outline-button";
    replace.type = "button";
    replace.textContent = "Replace";
    replace.addEventListener("click", () => replaceMeal(index));
    record.className = "button icon-button";
    record.type = "button";
    record.textContent = "Log meal";
    record.addEventListener("click", () => addMeal(meal.name, meal.calories));
    controls.append(calories, replace, record);
    row.append(type, detail, controls);
    return row;
  }));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function toggleWorkout(index) {
  const workout = workouts[index];
  workout.completed = !workout.completed;
  try {
    await requestApi("/api/logs", { type: "workout", label: workout.name, date: localDateKey(), completed: String(workout.completed) });
    if (workout.completed) logItems.push({ type: "workout", name: workout.name, date: localDateKey(), time: Date.now() });
    else logItems = logItems.filter((item) => !(item.type === "workout" && item.name === workout.name && item.date === localDateKey()));
    saveLogs();
    renderWorkouts();
    renderDashboard();
    showToast(workout.completed ? "Workout marked complete." : "Workout marked incomplete.");
  } catch (error) {
    workout.completed = !workout.completed;
    showToast(error.message);
  }
}

async function addMeal(name, calories) {
  const safeName = String(name).trim();
  const safeCalories = Number(calories);
  if (!safeName || !Number.isFinite(safeCalories) || safeCalories < 1 || safeCalories > 5000) {
    showToast("Enter a meal name and a calorie amount from 1 to 5,000.");
    return;
  }
  const item = { type: "meal", name: safeName, calories: safeCalories, date: localDateKey(), time: Date.now() };
  try {
    await requestApi("/api/logs", { type: "meal", label: item.name, calories: item.calories, date: item.date });
    logItems.push(item);
    saveLogs();
    renderDashboard();
    showMessage("mealMessage", "Meal added to today's log.");
    showToast("Meal recorded.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addWater(amount) {
  const safeAmount = Number(amount);
  if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 5000) throw new Error("Enter a water amount from 1 to 5,000 ml.");
  const item = { type: "water", amount: safeAmount, date: localDateKey(), time: Date.now() };
  await requestApi("/api/logs", { type: "water", amount: safeAmount, date: item.date });
  logItems.push(item);
  saveLogs();
  renderDashboard();
  showMessage("waterMessage", `${safeAmount} ml added to today's total.`);
}

async function replaceMeal(index) {
  try {
    const alternatives = await requestApi(`/api/meals?type=${encodeURIComponent(meals[index].type)}&diet=${encodeURIComponent(document.getElementById("diet").value)}`);
    const choices = alternatives.filter((meal) => meal.name !== meals[index].name);
    if (!choices.length) return showToast("No alternative is available for this meal.");
    const currentIndex = alternatives.findIndex((meal) => meal.name === meals[index].name);
    meals[index] = choices[(Math.max(currentIndex, -1) + 1) % choices.length];
    renderMeals();
  } catch (error) {
    showToast(error.message);
  }
}

function generateGroceries() {
  const ingredients = [...new Set(meals.flatMap((meal) => meal.ingredients))].sort((a, b) => a.localeCompare(b));
  const list = document.getElementById("groceryList");
  list.replaceChildren(...ingredients.map((ingredient) => {
    const row = document.createElement("li");
    row.textContent = ingredient;
    return row;
  }));
  document.getElementById("groceryArea").hidden = false;
  document.getElementById("groceryArea").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function saveProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const data = Object.fromEntries(form.entries());
  const age = Number(data.age);
  const height = Number(data.height);
  const weight = Number(data.weight);
  if (!Number.isInteger(age) || age < 13 || age > 100) return showMessage("profileMessage", "Age must be a whole number from 13 to 100.", true);
  if (!Number.isFinite(height) || height < 100 || height > 250) return showMessage("profileMessage", "Height must be between 100 and 250 cm.", true);
  if (!Number.isFinite(weight) || weight < 25 || weight > 350) return showMessage("profileMessage", "Weight must be between 25 and 350 kg.", true);
  try {
    profile = await requestApi("/api/profile", data);
    renderProfile();
    renderDashboard();
    showMessage("profileMessage", "Profile saved for this server session; estimates updated.");
  } catch (error) {
    showMessage("profileMessage", error.message, true);
  }
}

async function updateWeight(event) {
  event.preventDefault();
  const weight = Number(document.getElementById("weightEntry").value);
  if (!Number.isFinite(weight) || weight < 25 || weight > 350) return showMessage("weightMessage", "Enter a weight from 25 to 350 kg.", true);
  if (!profile) {
    document.getElementById("weight").value = weight;
    return showMessage("weightMessage", "Complete and save your profile first.", true);
  }
  try {
    profile = await requestApi("/api/profile", { ...profile, weight: String(weight) });
    renderProfile();
    renderDashboard();
    showMessage("weightMessage", "Current profile weight updated.");
  } catch (error) {
    showMessage("weightMessage", error.message, true);
  }
}

function bindEvents() {
  document.getElementById("profileForm").addEventListener("submit", saveProfile);
  document.getElementById("mealForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.getElementById("mealName").value.trim();
    const calories = Number(document.getElementById("mealCalories").value);
    if (!name || name.length > 60 || !Number.isInteger(calories) || calories < 1 || calories > 5000) return showMessage("mealMessage", "Enter a meal name and calories from 1 to 5,000.", true);
    addMeal(name, calories).then(() => event.currentTarget.reset());
  });
  document.getElementById("waterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await addWater(document.getElementById("waterAmount").value); }
    catch (error) { showMessage("waterMessage", error.message, true); }
  });
  document.getElementById("weightForm").addEventListener("submit", updateWeight);
  document.getElementById("groceryButton").addEventListener("click", generateGroceries);
  document.getElementById("closeGroceryButton").addEventListener("click", () => { document.getElementById("groceryArea").hidden = true; });
  document.getElementById("clearDayButton").addEventListener("click", async () => {
    if (!todayLogs().length && !workouts.some((workout) => workout.completed)) return showToast("There is no daily activity to clear.");
    if (!window.confirm("Clear today's meal, water, and workout entries? This cannot be undone.")) return;
    logItems = logItems.filter((item) => item.date !== localDateKey());
    workouts.forEach((workout) => { workout.completed = false; });
    saveLogs();
    try { await requestApi("/api/logs/clear", { date: localDateKey() }); } catch { /* Local demo records are still cleared. */ }
    renderWorkouts();
    renderDashboard();
    showToast("Today's log has been cleared.");
  });
  document.getElementById("resetButton").addEventListener("click", async () => {
    if (!window.confirm("Delete all saved demo logs and clear the profile from this server session?")) return;
    logItems = [];
    workouts.forEach((workout) => { workout.completed = false; });
    profile = null;
    saveLogs();
    document.getElementById("profileForm").reset();
    document.getElementById("resultBmi").textContent = "--";
    document.getElementById("resultCalories").textContent = "--";
    document.getElementById("weightValue").textContent = "--";
    document.getElementById("bmiValue").textContent = "--";
    document.getElementById("weightNote").textContent = "Add your profile";
    document.getElementById("bmiNote").textContent = "Estimate based on profile";
    try { await requestApi("/api/profile/clear", {}); await requestApi("/api/logs/clear", { date: "all" }); } catch { /* Local demo records are still reset. */ }
    renderWorkouts();
    renderDashboard();
    showToast("Demo data cleared.");
  });
}

async function initialize() {
  const now = new Date();
  document.getElementById("todayText").textContent = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  document.getElementById("dateNumber").textContent = String(now.getDate()).padStart(2, "0");
  document.getElementById("dateMonth").textContent = now.toLocaleDateString(undefined, { month: "long" }).toUpperCase();
  bindEvents();
  try {
    const [savedProfile, workoutPlan, mealPlan] = await Promise.all([
      requestApi("/api/profile"), requestApi("/api/workouts"), requestApi(`/api/meals?diet=balanced`)
    ]);
    profile = savedProfile.profile || null;
    workouts = workoutPlan.map((workout) => ({ ...workout, completed: logItems.some((item) => item.type === "workout" && item.name === workout.name && item.date === localDateKey()) }));
    meals = mealPlan;
    if (profile) renderProfile();
    renderWorkouts();
    renderMeals();
  } catch (error) {
    workouts = [
      { day: "MON", focus: "STRENGTH", name: "Upper body", exercises: "Push-ups 3 x 10, rows 3 x 12" },
      { day: "WED", focus: "CARDIO", name: "Steady movement", exercises: "Brisk walk or cycle, 30 min" },
      { day: "FRI", focus: "STRENGTH", name: "Lower body", exercises: "Squats 3 x 12, lunges 3 x 10" },
      { day: "SAT", focus: "RECOVERY", name: "Mobility", exercises: "Stretching and mobility, 20 min" }
    ];
    meals = fallbackMeals;
    renderWorkouts();
    renderMeals();
    showToast(`Server connection unavailable: ${error.message}`);
  }
  renderDashboard();
}

initialize();