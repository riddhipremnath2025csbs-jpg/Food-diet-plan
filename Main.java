import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

public class Main {
    private static final int PORT = 8000;
    private static Map<String, Object> profile;
    private static final List<Map<String, Object>> dailyLogs = new ArrayList<>();
    private static final List<Map<String, Object>> WORKOUTS = List.of(
        workout("MON", "STRENGTH", "Upper body", "Push-ups 3 x 10, rows 3 x 12"),
        workout("WED", "CARDIO", "Steady movement", "Brisk walk or cycle, 30 min"),
        workout("FRI", "STRENGTH", "Lower body", "Squats 3 x 12, lunges 3 x 10"),
        workout("SAT", "RECOVERY", "Mobility", "Stretching and mobility, 20 min")
    );
    private static final Map<String, List<Map<String, Object>>> MEALS = createMeals();

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", PORT), 0);
        server.createContext("/api/", Main::handleApi);
        server.createContext("/", Main::handleStatic);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("Form & Fuel is running at http://localhost:" + PORT);
    }

    private static void handleApi(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        try {
            if (path.equals("/api/profile") && method.equals("GET")) {
                sendJson(exchange, 200, Map.of("profile", profile == null ? Map.of() : profile));
            } else if (path.equals("/api/profile") && method.equals("POST")) {
                profile = calculateProfile(readForm(exchange));
                sendJson(exchange, 200, profile);
            } else if (path.equals("/api/profile/clear") && method.equals("POST")) {
                profile = null;
                sendJson(exchange, 200, Map.of("ok", true));
            } else if (path.equals("/api/calculate") && method.equals("POST")) {
                sendJson(exchange, 200, calculateProfile(readForm(exchange)));
            } else if (path.equals("/api/workouts") && method.equals("GET")) {
                sendJson(exchange, 200, WORKOUTS);
            } else if (path.equals("/api/meals") && method.equals("GET")) {
                Map<String, String> query = parseForm(exchange.getRequestURI().getRawQuery());
                String diet = query.getOrDefault("diet", "balanced");
                String type = query.get("type");
                List<Map<String, Object>> result = new ArrayList<>();
                for (Map<String, Object> meal : MEALS.getOrDefault(diet, MEALS.get("balanced"))) {
                    if (type == null || type.equalsIgnoreCase((String) meal.get("type"))) result.add(meal);
                }
                sendJson(exchange, 200, result);
            } else if (path.equals("/api/logs") && method.equals("GET")) {
                sendJson(exchange, 200, dailyLogs);
            } else if (path.equals("/api/logs") && method.equals("POST")) {
                Map<String, String> form = readForm(exchange);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("type", form.getOrDefault("type", ""));
                entry.put("date", form.getOrDefault("date", ""));
                entry.put("label", form.getOrDefault("label", ""));
                if (form.containsKey("calories")) entry.put("calories", safeNumber(form.get("calories")));
                if (form.containsKey("amount")) entry.put("amount", safeNumber(form.get("amount")));
                if (form.containsKey("completed")) entry.put("completed", Boolean.parseBoolean(form.get("completed")));
                dailyLogs.add(entry);
                sendJson(exchange, 201, Map.of("ok", true, "entry", entry));
            } else if (path.equals("/api/logs/clear") && method.equals("POST")) {
                String date = readForm(exchange).getOrDefault("date", "");
                if (date.equals("all")) dailyLogs.clear();
                else dailyLogs.removeIf(entry -> date.equals(entry.get("date")));
                sendJson(exchange, 200, Map.of("ok", true));
            } else {
                sendJson(exchange, 404, Map.of("error", "API endpoint not found."));
            }
        } catch (IllegalArgumentException exception) {
            sendJson(exchange, 400, Map.of("error", exception.getMessage()));
        } catch (Exception exception) {
            sendJson(exchange, 500, Map.of("error", "The server could not complete the request."));
        }
    }

    private static Map<String, Object> calculateProfile(Map<String, String> input) {
        int age = parseInt(input.get("age"), "Age");
        double height = parseDouble(input.get("height"), "Height");
        double weight = parseDouble(input.get("weight"), "Weight");
        if (age < 13 || age > 100) throw new IllegalArgumentException("Age must be from 13 to 100.");
        if (height < 100 || height > 250) throw new IllegalArgumentException("Height must be from 100 to 250 cm.");
        if (weight < 25 || weight > 350) throw new IllegalArgumentException("Weight must be from 25 to 350 kg.");

        String activity = input.getOrDefault("activity", "moderate");
        double multiplier = switch (activity) {
            case "sedentary" -> 1.2;
            case "light" -> 1.375;
            case "moderate" -> 1.55;
            case "active" -> 1.725;
            default -> throw new IllegalArgumentException("Choose a valid activity level.");
        };
        String goal = input.getOrDefault("goal", "maintain");
        int adjustment = switch (goal) {
            case "lose" -> -300;
            case "maintain" -> 0;
            case "gain" -> 300;
            default -> throw new IllegalArgumentException("Choose a valid fitness goal.");
        };
        String diet = input.getOrDefault("diet", "balanced");
        if (!List.of("balanced", "vegetarian", "vegan", "high-protein").contains(diet)) {
            throw new IllegalArgumentException("Choose a valid dietary preference.");
        }

        double bmi = weight / Math.pow(height / 100.0, 2);
        double estimatedBmr = 10 * weight + 6.25 * height - 5 * age - 80.5;
        int calories = (int) Math.round(estimatedBmr * multiplier + adjustment);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("age", age);
        result.put("height", height);
        result.put("weight", weight);
        result.put("activity", activity);
        result.put("diet", diet);
        result.put("goal", goal);
        result.put("bmi", Math.round(bmi * 10.0) / 10.0);
        result.put("calories", Math.max(1200, calories));
        return result;
    }

    private static Map<String, String> readForm(HttpExchange exchange) throws IOException {
        return parseForm(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
    }

    private static Map<String, String> parseForm(String raw) {
        Map<String, String> values = new LinkedHashMap<>();
        if (raw == null || raw.isBlank()) return values;
        for (String part : raw.split("&")) {
            String[] pair = part.split("=", 2);
            String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8);
            String value = pair.length > 1 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
            values.put(key, value);
        }
        return values;
    }

    private static int parseInt(String value, String label) {
        try { return Integer.parseInt(value); }
        catch (RuntimeException exception) { throw new IllegalArgumentException(label + " must be a whole number."); }
    }

    private static double parseDouble(String value, String label) {
        try {
            double result = Double.parseDouble(value);
            if (!Double.isFinite(result)) throw new NumberFormatException();
            return result;
        } catch (RuntimeException exception) {
            throw new IllegalArgumentException(label + " must be a valid number.");
        }
    }

    private static double safeNumber(String value) {
        try { return Double.parseDouble(value); }
        catch (RuntimeException exception) { return 0; }
    }

    private static Map<String, Object> workout(String day, String focus, String name, String exercises) {
        return Map.of("day", day, "focus", focus, "name", name, "exercises", exercises);
    }

    private static Map<String, List<Map<String, Object>>> createMeals() {
        Map<String, List<Map<String, Object>>> plans = new LinkedHashMap<>();
        plans.put("balanced", List.of(
            meal("Breakfast", "Oats with banana and yogurt", 390, "Rolled oats", "Bananas", "Plain yogurt", "Cinnamon"),
            meal("Lunch", "Lentil and roasted vegetable bowl", 520, "Lentils", "Brown rice", "Carrots", "Spinach", "Olive oil"),
            meal("Dinner", "Herbed salmon with potatoes", 610, "Salmon", "Potatoes", "Green beans", "Lemon", "Dill"),
            meal("Snack", "Apple with peanut butter", 210, "Apples", "Peanut butter")
        ));
        plans.put("vegetarian", List.of(
            meal("Breakfast", "Cottage cheese and fruit toast", 370, "Wholegrain bread", "Cottage cheese", "Peaches", "Pumpkin seeds"),
            meal("Lunch", "Chickpea and quinoa salad", 490, "Chickpeas", "Quinoa", "Cucumber", "Tomatoes", "Parsley"),
            meal("Dinner", "Tofu and vegetable stir-fry", 550, "Firm tofu", "Brown rice", "Broccoli", "Bell peppers", "Soy sauce"),
            meal("Snack", "Greek yogurt and walnuts", 220, "Greek yogurt", "Walnuts", "Honey")
        ));
        plans.put("vegan", List.of(
            meal("Breakfast", "Overnight oats with berries", 380, "Rolled oats", "Oat milk", "Berries", "Chia seeds"),
            meal("Lunch", "Black bean sweet potato bowl", 510, "Black beans", "Sweet potatoes", "Avocado", "Lime"),
            meal("Dinner", "Lentil tomato pasta", 570, "Lentils", "Wholegrain pasta", "Tomatoes", "Spinach", "Basil"),
            meal("Snack", "Hummus and crisp vegetables", 200, "Hummus", "Carrots", "Cucumber", "Celery")
        ));
        plans.put("high-protein", List.of(
            meal("Breakfast", "Egg and spinach toast", 410, "Eggs", "Wholegrain bread", "Spinach", "Tomatoes"),
            meal("Lunch", "Chicken and brown rice bowl", 560, "Chicken breast", "Brown rice", "Broccoli", "Lemon"),
            meal("Dinner", "Turkey and bean skillet", 590, "Lean turkey", "Cannellini beans", "Tomatoes", "Zucchini"),
            meal("Snack", "Skyr with almonds", 230, "Skyr", "Almonds", "Blueberries")
        ));
        return plans;
    }

    private static Map<String, Object> meal(String type, String name, int calories, String... ingredients) {
        return Map.of("type", type, "name", name, "calories", calories, "ingredients", List.of(ingredients));
    }

    private static void handleStatic(HttpExchange exchange) throws IOException {
        String requestPath = exchange.getRequestURI().getPath();
        String fileName = switch (requestPath) {
            case "/", "/index.html" -> "index.html";
            case "/style.css" -> "style.css";
            case "/script.js" -> "script.js";
            default -> null;
        };
        if (fileName == null) {
            sendText(exchange, 404, "Not found.", "text/plain; charset=UTF-8");
            return;
        }
        Path file = Path.of(fileName);
        if (!Files.isRegularFile(file)) {
            sendText(exchange, 500, "Application file missing: " + fileName, "text/plain; charset=UTF-8");
            return;
        }
        String contentType = fileName.endsWith(".html") ? "text/html; charset=UTF-8" : fileName.endsWith(".css") ? "text/css; charset=UTF-8" : "text/javascript; charset=UTF-8";
        byte[] content = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.sendResponseHeaders(200, content.length);
        exchange.getResponseBody().write(content);
        exchange.close();
    }

    private static void sendJson(HttpExchange exchange, int status, Object value) throws IOException {
        sendText(exchange, status, toJson(value), "application/json; charset=UTF-8");
    }

    private static void sendText(HttpExchange exchange, int status, String value, String contentType) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String toJson(Object value) {
        if (value == null) return "null";
        if (value instanceof String text) return "\"" + escapeJson(text) + "\"";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Map<?, ?> map) {
            List<String> fields = new ArrayList<>();
            map.forEach((key, item) -> fields.add(toJson(String.valueOf(key)) + ":" + toJson(item)));
            return "{" + String.join(",", fields) + "}";
        }
        if (value instanceof Iterable<?> values) {
            List<String> items = new ArrayList<>();
            values.forEach(item -> items.add(toJson(item)));
            return "[" + String.join(",", items) + "]";
        }
        return toJson(value.toString());
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }
}