# Form & Fuel Fitness and Diet Planner

A small local fitness dashboard built with HTML, CSS, vanilla JavaScript, and Java 21. It has no third-party dependencies or external services.

## Requirements

- Java Development Kit (JDK) 17 or newer. The built-in HTTP server is included with the JDK.
- A modern web browser.

## Run on Windows

Open PowerShell in this folder and compile the Java server:

```powershell
javac Main.java
```

Start the server:

```powershell
java Main
```

Open [http://localhost:8000](http://localhost:8000) in a browser. Keep the terminal open while using the app. Press Ctrl+C to stop the server. If port 8000 is already in use, close the other application before starting this server.

## Features

- Dashboard totals for logged calories, profile weight and BMI, water, and completed weekly workouts.
- Profile form with validation and Java-calculated BMI and estimated daily calorie needs.
- Weekly workout schedule with completion controls.
- Diet-specific meal suggestions, meal replacement, meal logging, and a grocery list generated from the current suggestions.
- Daily meal and water tracking, a seven-day calorie chart, and confirmation-protected clear and reset controls.
- Browser localStorage for ordinary meal, water, and workout demo logs. Profile details and weight are not written to localStorage; the Java server keeps them in memory only for its current session. Stopping the server clears the in-memory profile and logs.

## Calorie estimate

The app uses a simplified, sex-neutral BMR estimate, an activity multiplier, and a small goal adjustment. It is an educational estimate, not medical advice. The profile form and calculation endpoint validate age, height, weight, activity, goal, and dietary preference.

## Backend endpoints

- `GET /api/profile` and `POST /api/profile`
- `POST /api/calculate`
- `GET /api/workouts`
- `GET /api/meals?diet=balanced` (also supports `vegetarian`, `vegan`, and `high-protein`; an optional `type` filters a meal category)
- `GET /api/logs` and `POST /api/logs`
- `POST /api/profile/clear` and `POST /api/logs/clear`