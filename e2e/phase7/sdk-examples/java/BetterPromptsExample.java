import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import okhttp3.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * BetterPrompts API - Java SDK Example
 * 
 * Dependencies (Maven):
 * <dependency>
 *     <groupId>com.squareup.okhttp3</groupId>
 *     <artifactId>okhttp</artifactId>
 *     <version>4.11.0</version>
 * </dependency>
 * <dependency>
 *     <groupId>com.fasterxml.jackson.core</groupId>
 *     <artifactId>jackson-databind</artifactId>
 *     <version>2.15.2</version>
 * </dependency>
 * 
 * Usage:
 * javac -cp ".:okhttp-4.11.0.jar:jackson-databind-2.15.2.jar" BetterPromptsExample.java
 * java -cp ".:okhttp-4.11.0.jar:jackson-databind-2.15.2.jar" BetterPromptsExample
 */
public class BetterPromptsExample {

    /**
     * BetterPrompts API Client
     */
    public static class BetterPromptsClient {
        private final String apiKey;
        private final String baseUrl;
        private final OkHttpClient httpClient;
        private final ObjectMapper objectMapper;

        public BetterPromptsClient(String apiKey) {
            this.apiKey = apiKey;
            this.baseUrl = "https://api.betterprompts.io/v1";
            this.objectMapper = new ObjectMapper();
            
            // Configure HTTP client with retry interceptor
            this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(Duration.ofSeconds(30))
                .readTimeout(Duration.ofSeconds(30))
                .addInterceptor(new RetryInterceptor())
                .build();
        }

        /**
         * Enhance a single prompt
         */
        public EnhanceResponse enhance(EnhanceRequest request) throws IOException, ApiException {
            String json = objectMapper.writeValueAsString(request);
            RequestBody body = RequestBody.create(json, MediaType.parse("application/json"));

            Request httpRequest = new Request.Builder()
                .url(baseUrl + "/enhance")
                .post(body)
                .addHeader("Content-Type", "application/json")
                .addHeader("X-API-Key", apiKey)
                .build();

            try (Response response = httpClient.newCall(httpRequest).execute()) {
                return handleResponse(response, EnhanceResponse.class);
            }
        }

        /**
         * Get available techniques
         */
        public List<Technique> getTechniques(String category, Integer complexity) throws IOException, ApiException {
            HttpUrl.Builder urlBuilder = HttpUrl.parse(baseUrl + "/techniques").newBuilder();
            if (category != null) {
                urlBuilder.addQueryParameter("category", category);
            }
            if (complexity != null) {
                urlBuilder.addQueryParameter("complexity", String.valueOf(complexity));
            }

            Request request = new Request.Builder()
                .url(urlBuilder.build())
                .get()
                .addHeader("X-API-Key", apiKey)
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                return Arrays.asList(handleResponse(response, Technique[].class));
            }
        }

        /**
         * Get enhancement history (requires authentication)
         */
        public HistoryResponse getHistory(String bearerToken, int page, int limit) throws IOException, ApiException {
            HttpUrl url = HttpUrl.parse(baseUrl + "/history").newBuilder()
                .addQueryParameter("page", String.valueOf(page))
                .addQueryParameter("limit", String.valueOf(limit))
                .build();

            Request request = new Request.Builder()
                .url(url)
                .get()
                .addHeader("Authorization", "Bearer " + bearerToken)
                .build();

            try (Response response = httpClient.newCall(request).execute()) {
                return handleResponse(response, HistoryResponse.class);
            }
        }

        private <T> T handleResponse(Response response, Class<T> responseClass) throws IOException, ApiException {
            String responseBody = response.body().string();
            
            if (!response.isSuccessful()) {
                if (response.code() == 429) {
                    String retryAfter = response.header("Retry-After", "60");
                    throw new RateLimitException("Rate limited. Retry after " + retryAfter + " seconds");
                }
                
                try {
                    ErrorResponse error = objectMapper.readValue(responseBody, ErrorResponse.class);
                    throw new ApiException(response.code(), error.error, error.message);
                } catch (IOException e) {
                    throw new ApiException(response.code(), "Unknown error", responseBody);
                }
            }

            return objectMapper.readValue(responseBody, responseClass);
        }
    }

    /**
     * Retry interceptor for handling transient failures
     */
    static class RetryInterceptor implements Interceptor {
        private static final int MAX_RETRIES = 3;

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request request = chain.request();
            Response response = null;
            IOException lastException = null;

            for (int i = 0; i < MAX_RETRIES; i++) {
                try {
                    response = chain.proceed(request);
                    
                    if (response.isSuccessful() || response.code() < 500) {
                        return response;
                    }
                    
                    response.close();
                } catch (IOException e) {
                    lastException = e;
                }

                if (i < MAX_RETRIES - 1) {
                    try {
                        TimeUnit.SECONDS.sleep((long) Math.pow(2, i));
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        throw new IOException("Interrupted during retry", e);
                    }
                }
            }

            if (lastException != null) {
                throw lastException;
            }
            return response;
        }
    }

    // Request/Response classes
    public static class EnhanceRequest {
        public String text;
        public Map<String, Object> context;
        public List<String> prefer_techniques;
        public List<String> exclude_techniques;
        public String target_complexity;

        public EnhanceRequest(String text) {
            this.text = text;
        }
    }

    public static class EnhanceResponse {
        public String id;
        public String original_text;
        public String enhanced_text;
        public String intent;
        public String complexity;
        public List<String> techniques_used;
        public double confidence;
        public double processing_time_ms;
        public boolean enhanced;
    }

    public static class Technique {
        public String id;
        public String name;
        public String category;
        public String description;
        public int complexity;
        public List<String> examples;
        public Effectiveness effectiveness;
        
        public static class Effectiveness {
            public double overall;
            public Map<String, Double> byIntent;
        }
    }

    public static class HistoryResponse {
        public List<HistoryItem> items;
        public int total;
        public int page;
        public int limit;
        public int total_pages;
        public boolean has_next;
        public boolean has_prev;
    }

    public static class HistoryItem {
        public String id;
        public String user_id;
        public String original_text;
        public String enhanced_text;
        public String intent;
        public String complexity;
        public List<String> techniques_used;
        public double confidence;
        public double processing_time_ms;
        public String created_at;
        public String updated_at;
    }

    public static class ErrorResponse {
        public String error;
        public String message;
        public Map<String, Object> details;
        public String request_id;
    }

    // Exceptions
    public static class ApiException extends Exception {
        public final int statusCode;
        public final String error;

        public ApiException(int statusCode, String error, String message) {
            super(message);
            this.statusCode = statusCode;
            this.error = error;
        }
    }

    public static class RateLimitException extends ApiException {
        public RateLimitException(String message) {
            super(429, "rate_limit_exceeded", message);
        }
    }

    /**
     * Verify webhook signature
     */
    public static boolean verifyWebhookSignature(String payload, String signature, String secret) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKeySpec);
            
            byte[] hash = hmac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expectedSignature = "sha256=" + bytesToHex(hash);
            
            return signature.equals(expectedSignature);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            return false;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    // Example methods
    private static void exampleBasicEnhancement(BetterPromptsClient client) {
        System.out.println("\n=== Basic Enhancement ===");
        
        try {
            EnhanceRequest request = new EnhanceRequest("Write a function to find prime numbers");
            EnhanceResponse response = client.enhance(request);
            
            System.out.println("Original: " + response.original_text);
            System.out.println("Enhanced: " + response.enhanced_text);
            System.out.println("Techniques: " + String.join(", ", response.techniques_used));
            System.out.printf("Processing time: %.2fms%n", response.processing_time_ms);
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }

    private static void exampleEnhancementWithOptions(BetterPromptsClient client) {
        System.out.println("\n=== Enhancement with Options ===");
        
        try {
            EnhanceRequest request = new EnhanceRequest("Explain object-oriented programming");
            request.context = new HashMap<>();
            request.context.put("audience", "beginner");
            request.context.put("language", "Java");
            
            request.prefer_techniques = Arrays.asList("examples", "step_by_step");
            request.exclude_techniques = Arrays.asList("mathematical_notation");
            request.target_complexity = "simple";
            
            EnhanceResponse response = client.enhance(request);
            
            System.out.println("Intent: " + response.intent);
            System.out.println("Complexity: " + response.complexity);
            System.out.printf("Confidence: %.2f%n", response.confidence);
            System.out.println("Enhanced (first 200 chars): " + 
                response.enhanced_text.substring(0, Math.min(200, response.enhanced_text.length())) + "...");
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }

    private static void exampleGetTechniques(BetterPromptsClient client) {
        System.out.println("\n=== Available Techniques ===");
        
        try {
            List<Technique> techniques = client.getTechniques("reasoning", null);
            
            System.out.printf("Found %d reasoning techniques:%n", techniques.size());
            for (int i = 0; i < Math.min(5, techniques.size()); i++) {
                Technique tech = techniques.get(i);
                System.out.printf("%n- %s (%s)%n", tech.name, tech.id);
                System.out.printf("  Category: %s%n", tech.category);
                System.out.printf("  Complexity: %d/5%n", tech.complexity);
                System.out.printf("  Effectiveness: %.2f%n", tech.effectiveness.overall);
            }
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
        }
    }

    private static void exampleErrorHandling(BetterPromptsClient client) {
        System.out.println("\n=== Error Handling ===");
        
        Map<String, EnhanceRequest> testCases = new HashMap<>();
        
        EnhanceRequest emptyText = new EnhanceRequest("");
        testCases.put("Empty text", emptyText);
        
        EnhanceRequest longText = new EnhanceRequest(String.join("", Collections.nCopies(5001, "a")));
        testCases.put("Text too long", longText);
        
        EnhanceRequest invalidTechnique = new EnhanceRequest("Test");
        invalidTechnique.prefer_techniques = Arrays.asList("invalid_technique");
        testCases.put("Invalid technique", invalidTechnique);
        
        for (Map.Entry<String, EnhanceRequest> entry : testCases.entrySet()) {
            try {
                client.enhance(entry.getValue());
            } catch (ApiException e) {
                System.out.printf("%n%s: %s (Status: %d)%n", entry.getKey(), e.getMessage(), e.statusCode);
            } catch (Exception e) {
                System.out.printf("%n%s: %s%n", entry.getKey(), e.getMessage());
            }
        }
    }

    // Webhook handler example (using Spark framework)
    private static void webhookHandlerExample() {
        System.out.println("\n=== Webhook Handler Example ===");
        System.out.println("Example using Spark Java framework:");
        System.out.println("""
        
        import spark.Spark;
        
        Spark.post("/webhook", (request, response) -> {
            String signature = request.headers("X-Webhook-Signature");
            String payload = request.body();
            String secret = "your-webhook-secret";
            
            // Verify signature
            if (!verifyWebhookSignature(payload, signature, secret)) {
                response.status(401);
                return "{\"error\": \"Invalid signature\"}";
            }
            
            // Parse event
            ObjectMapper mapper = new ObjectMapper();
            JsonNode event = mapper.readTree(payload);
            String eventType = event.get("event").asText();
            
            switch (eventType) {
                case "enhancement.completed":
                    System.out.println("Enhancement completed: " + event.get("data").get("id").asText());
                    break;
                case "batch.finished":
                    System.out.println("Batch finished: " + event.get("data").get("job_id").asText());
                    break;
                case "error.occurred":
                    System.out.println("Error occurred: " + event.get("data"));
                    break;
            }
            
            response.status(200);
            return "{\"received\": true}";
        });
        """);
    }

    public static void main(String[] args) {
        System.out.println("BetterPrompts API - Java Examples");
        System.out.println("=================================");

        // Initialize client
        String apiKey = System.getenv("BETTERPROMPTS_API_KEY");
        if (apiKey == null) {
            apiKey = "your-api-key-here";
        }

        BetterPromptsClient client = new BetterPromptsClient(apiKey);

        // Run examples
        exampleBasicEnhancement(client);
        exampleEnhancementWithOptions(client);
        exampleGetTechniques(client);
        exampleErrorHandling(client);
        webhookHandlerExample();

        // For authenticated endpoints, you would need to login first:
        // AuthResponse auth = client.login("user@example.com", "password");
        // String token = auth.accessToken;
        // HistoryResponse history = client.getHistory(token, 1, 10);
    }
}