package main

import (
	"fmt"
	"os"

	"github.com/betterprompts/api-gateway/internal/auth"
	"github.com/betterprompts/api-gateway/internal/handlers"
	"github.com/betterprompts/api-gateway/internal/middleware"
	"github.com/betterprompts/api-gateway/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func main() {
	// Initialize logger
	logger := logrus.New()
	logger.SetFormatter(&logrus.JSONFormatter{})
	
	// Set log level from environment
	logLevel := os.Getenv("LOG_LEVEL")
	if logLevel == "" {
		logLevel = "info"
	}
	level, err := logrus.ParseLevel(logLevel)
	if err != nil {
		logger.Warnf("Invalid log level %s, defaulting to info", logLevel)
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)
	
	// Get environment configuration
	environment := os.Getenv("NODE_ENV")
	if environment == "" {
		environment = os.Getenv("ENVIRONMENT")
	}
	if environment == "" {
		environment = "development"
	}
	
	// Log environment info
	logger.WithFields(logrus.Fields{
		"log_level":   logLevel,
		"environment": environment,
	}).Info("Starting API Gateway")

	// Initialize service clients
	clients, err := services.InitializeClients(logger)
	if err != nil {
		logger.WithError(err).Fatal("Failed to initialize service clients")
	}
	defer clients.Close()

	// Initialize JWT manager
	jwtConfig := auth.JWTConfig{
		SecretKey:        os.Getenv("JWT_SECRET_KEY"),
		RefreshSecretKey: os.Getenv("JWT_REFRESH_SECRET_KEY"),
		Issuer:          "betterprompts",
	}
	jwtManager := auth.NewJWTManager(jwtConfig)

	// Initialize email service
	emailService := services.NewEmailService(logger)

	// Initialize user service
	// Type assert to concrete type as NewUserService expects *DatabaseService
	dbService, ok := clients.Database.(*services.DatabaseService)
	if !ok {
		logger.Fatal("Database service is not of expected type")
	}
	userService := services.NewUserService(dbService, emailService)

	// Initialize auth handler
	authHandler := handlers.NewAuthHandler(userService, jwtManager, clients.Cache, logger)
	
	// Initialize feedback handler
	feedbackHandler := handlers.NewFeedbackHandler(clients, logger.WithField("component", "feedback"))

	// Setup Gin router
	router := gin.New()
	
	// Add middleware
	router.Use(gin.Recovery())
	router.Use(middleware.RequestID())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.SessionMiddleware(clients.Cache, logger))
	
	// CORS configuration
	router.Use(middleware.CORSConfig(logger))

	// Public routes
	public := router.Group("/api/v1")
	{
		// Health check
		public.GET("/health", handlers.HealthCheck)
		public.GET("/ready", handlers.ReadinessCheck(clients))
		
		// Authentication routes
		public.POST("/auth/register", authHandler.Register)
		public.POST("/auth/login", authHandler.Login)
		public.POST("/auth/refresh", authHandler.RefreshToken)
		public.POST("/auth/verify-email", authHandler.VerifyEmail)
		public.POST("/auth/resend-verification", authHandler.ResendVerification)
		
		// Public analysis endpoint (optional auth)
		public.POST("/analyze", 
			middleware.OptionalAuth(jwtManager, logger),
			handlers.AnalyzeIntent(clients))
		
		// Techniques endpoint (public)
		public.GET("/techniques", handlers.GetAvailableTechniques(clients))
		
		// Main enhancement endpoint (public with optional auth)
		public.POST("/enhance", 
			middleware.OptionalAuth(jwtManager, logger),
			middleware.RateLimitMiddleware(clients.Cache, middleware.GetRateLimitConfigForEnvironment(environment), logger),
			handlers.EnhancePrompt(clients))
	}

	// Protected routes
	protected := router.Group("/api/v1")
	protected.Use(middleware.AuthMiddleware(jwtManager, logger))
	{
		// User profile
		protected.GET("/auth/profile", authHandler.GetProfile)
		protected.PUT("/auth/profile", authHandler.UpdateProfile)
		protected.POST("/auth/change-password", authHandler.ChangePassword)
		protected.POST("/auth/logout", authHandler.Logout)
		
		// Batch enhancement endpoint (commented out - not implemented yet)
		// protected.POST("/enhance/batch",
		// 	middleware.RateLimitMiddleware(clients.Cache, middleware.GetRateLimitConfigForEnvironment(environment), logger),
		// 	handlers.HandleBatchEnhance(clients))
		
		// Prompt history endpoints
		protected.GET("/prompts/history", handlers.GetPromptHistory(clients))
		protected.GET("/prompts/:id", handlers.GetPromptByID(clients))
		protected.POST("/prompts/:id/rerun", handlers.RerunPrompt(clients))
		
		// Legacy history endpoints (for backward compatibility)
		protected.GET("/history", handlers.GetPromptHistory(clients))
		protected.GET("/history/:id", handlers.GetPromptHistoryItem(clients))
		protected.DELETE("/history/:id", handlers.DeletePromptHistoryItem(clients))
		
		// Techniques selection endpoint (requires auth to save preferences)
		protected.POST("/techniques/select", handlers.SelectTechniques(clients))
		
		// Feedback endpoints
		protected.POST("/feedback", feedbackHandler.SubmitFeedback)
		protected.GET("/feedback/:prompt_history_id", feedbackHandler.GetFeedback)
		protected.POST("/feedback/effectiveness", feedbackHandler.GetTechniqueEffectiveness)
	}

	// Admin routes
	admin := router.Group("/api/v1/admin")
	admin.Use(middleware.AuthMiddleware(jwtManager, logger))
	admin.Use(middleware.RequireRole("admin"))
	{
		// User management
		admin.GET("/users", handlers.GetUsers(clients))
		admin.GET("/users/:id", handlers.GetUser(clients))
		admin.PUT("/users/:id", handlers.UpdateUser(clients))
		admin.DELETE("/users/:id", handlers.DeleteUser(clients))
		
		// System metrics
		admin.GET("/metrics", handlers.GetSystemMetrics(clients))
		admin.GET("/metrics/usage", handlers.GetUsageMetrics(clients))
		
		// Cache management
		admin.POST("/cache/clear", handlers.ClearCache(clients))
		admin.POST("/cache/invalidate/:user_id", handlers.InvalidateUserCache(clients))
	}

	// Developer API routes
	developer := router.Group("/api/v1/dev")
	developer.Use(middleware.AuthMiddleware(jwtManager, logger))
	developer.Use(middleware.RequireRole("developer", "admin"))
	{
		// API key management
		developer.POST("/api-keys", handlers.CreateAPIKey(clients))
		developer.GET("/api-keys", handlers.GetAPIKeys(clients))
		developer.DELETE("/api-keys/:id", handlers.DeleteAPIKey(clients))
		
		// Usage analytics
		developer.GET("/analytics/usage", handlers.GetDeveloperUsage(clients))
		developer.GET("/analytics/performance", handlers.GetPerformanceMetrics(clients))
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Infof("Starting API Gateway on port %s", port)
	if err := router.Run(fmt.Sprintf(":%s", port)); err != nil {
		logger.WithError(err).Fatal("Failed to start server")
	}
}