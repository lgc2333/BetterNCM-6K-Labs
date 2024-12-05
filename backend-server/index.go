package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	port         = 9863
	wsPath       = "/backend-connect"
	queryPath    = "/query"
	writeTimeout = 3 * time.Second
	readTimeout  = 3 * time.Second
)

// Message 对应 TypeScript 中的 Message 接口
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
	Echo interface{} `json:"echo,omitempty"`
}

// Answer 对应 TypeScript 中的 Answer 接口
type Answer struct {
	Data interface{} `json:"data"`
	Echo interface{} `json:"echo,omitempty"`
}

// ConnectionManager 管理 WebSocket 连接
type ConnectionManager struct {
	conn      *websocket.Conn
	mutex     sync.RWMutex
	callbacks map[string]chan Answer
}

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	manager = &ConnectionManager{
		callbacks: make(map[string]chan Answer),
	}
)

// 添加 CORS 头的辅助函数
func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Max-Age", "3600")
}

// CORS 中间件
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func (cm *ConnectionManager) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	cm.mutex.Lock()
	if cm.conn != nil {
		cm.conn.Close()
	}
	cm.conn = conn
	cm.mutex.Unlock()

	log.Println("New WebSocket connection established")

	// 处理接收到的消息
	go func() {
		for {
			var answer Answer
			err := conn.ReadJSON(&answer)
			if err != nil {
				log.Printf("Read error: %v", err)
				cm.mutex.Lock()
				cm.conn = nil
				cm.mutex.Unlock()
				conn.Close()
				return
			}

			// 如果存在回调，发送答案
			if ch, ok := cm.callbacks[fmt.Sprint(answer.Echo)]; ok {
				ch <- answer
				delete(cm.callbacks, fmt.Sprint(answer.Echo))
			}
		}
	}()
}

func (cm *ConnectionManager) query() (Answer, error) {
	cm.mutex.RLock()
	conn := cm.conn
	cm.mutex.RUnlock()

	if conn == nil {
		return Answer{}, fmt.Errorf("no active WebSocket connection")
	}

	// 生成唯一的 echo ID
	echo := uuid.New().String()
	message := Message{
		Type: "query",
		Data: nil,
		Echo: echo,
	}

	// 创建等待响应的通道
	responseChan := make(chan Answer, 1)
	cm.mutex.Lock()
	cm.callbacks[echo] = responseChan
	cm.mutex.Unlock()

	// 设置写入超时
	conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	if err := conn.WriteJSON(message); err != nil {
		cm.mutex.Lock()
		delete(cm.callbacks, echo)
		cm.mutex.Unlock()
		return Answer{}, fmt.Errorf("failed to send message: %v", err)
	}

	// 等待响应，带超时
	select {
	case answer := <-responseChan:
		return answer, nil
	case <-time.After(readTimeout):
		cm.mutex.Lock()
		delete(cm.callbacks, echo)
		cm.mutex.Unlock()
		return Answer{}, fmt.Errorf("timeout waiting for response")
	}
}

// 修改后的 handleQuery 函数
func handleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	answer, err := manager.query()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(answer.Data)
}

// 修改 main 函数中的路由注册
func main() {
	http.HandleFunc(wsPath, corsMiddleware(manager.handleWebSocket))
	http.HandleFunc(queryPath, corsMiddleware(handleQuery))

	addr := fmt.Sprintf(":%d", port)
	log.Printf("Starting server on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
