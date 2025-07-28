package websocket

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

// Message types
const (
	MessageTypeSubscribe   = "subscribe"
	MessageTypeUnsubscribe = "unsubscribe"
	MessageTypeMetric      = "metric"
	MessageTypePing        = "ping"
	MessageTypePong        = "pong"
)

// Available channels
const (
	ChannelPerformance    = "performance"
	ChannelUsage         = "usage"
	ChannelTechniqueStats = "technique_stats"
)

// Client represents a WebSocket client
type Client struct {
	hub          *Hub
	conn         *websocket.Conn
	send         chan []byte
	subscriptions map[string]bool
}

// Hub maintains active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	metrics    *MetricsGenerator
}

// Message represents a WebSocket message
type Message struct {
	Type      string                 `json:"type"`
	Channel   string                 `json:"channel,omitempty"`
	Channels  []string              `json:"channels,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp string                 `json:"timestamp"`
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	hub := &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		metrics:    NewMetricsGenerator(),
	}
	
	// Start the hub
	go hub.run()
	
	// Start metrics broadcasting
	go hub.broadcastMetrics()
	
	return hub
}

// run handles hub operations
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("Client registered. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client unregistered. Total clients: %d", len(h.clients))
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client's send channel is full, close it
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// broadcastMetrics sends metrics updates every 5 seconds
func (h *Hub) broadcastMetrics() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Broadcast performance metrics
			perfMetrics := h.metrics.GeneratePerformanceMetrics()
			h.broadcastToChannel(ChannelPerformance, perfMetrics)

			// Broadcast usage metrics
			usageMetrics := h.metrics.GenerateUsageMetrics()
			h.broadcastToChannel(ChannelUsage, usageMetrics)

			// Broadcast technique stats
			techStats := h.metrics.GenerateTechniqueStats()
			h.broadcastToChannel(ChannelTechniqueStats, techStats)
		}
	}
}

// broadcastToChannel sends a message to all clients subscribed to a channel
func (h *Hub) broadcastToChannel(channel string, data map[string]interface{}) {
	msg := Message{
		Type:      MessageTypeMetric,
		Channel:   channel,
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	for client := range h.clients {
		if client.subscriptions[channel] {
			select {
			case client.send <- msgBytes:
			default:
				// Client's send channel is full
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

// ServeWS handles WebSocket connections
func (h *Hub) ServeWS(conn *websocket.Conn) {
	client := &Client{
		hub:           h,
		conn:          conn,
		send:          make(chan []byte, 256),
		subscriptions: make(map[string]bool),
	}
	
	client.hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// readPump handles incoming messages from the client
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		var msg Message
		err := c.conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		switch msg.Type {
		case MessageTypeSubscribe:
			for _, channel := range msg.Channels {
				c.subscriptions[channel] = true
				log.Printf("Client subscribed to channel: %s", channel)
			}

		case MessageTypeUnsubscribe:
			for _, channel := range msg.Channels {
				delete(c.subscriptions, channel)
				log.Printf("Client unsubscribed from channel: %s", channel)
			}

		case MessageTypePing:
			// Send pong response
			pong := Message{
				Type:      MessageTypePong,
				Timestamp: time.Now().UTC().Format(time.RFC3339),
			}
			if pongBytes, err := json.Marshal(pong); err == nil {
				c.send <- pongBytes
			}
		}
	}
}

// writePump handles sending messages to the client
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			c.conn.WriteMessage(websocket.TextMessage, message)

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}