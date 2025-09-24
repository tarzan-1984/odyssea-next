# WebSocket Integration Setup

## Обзор

WebSocket интеграция успешно добавлена в проект Odyssea-backend-ui. Система обеспечивает real-time функциональность для чата с автоматическим переподключением, typing индикаторами и синхронизацией сообщений.

## Что было реализовано

### 1. WebSocket Context (`src/context/WebSocketContext.tsx`)

- Управление WebSocket соединением
- Автоматическое переподключение с экспоненциальной задержкой
- Обработка ошибок аутентификации
- Интеграция с существующими Zustand stores

### 2. Специализированные хуки

- `useWebSocketMessages` - управление сообщениями в real-time
- `useWebSocketChatRooms` - управление чат-комнатами
- `useWebSocketNotifications` - обработка уведомлений
- `useWebSocketChatSync` - интеграция с существующим `useChatSync`

### 3. Обновленные компоненты

- `ChatList.tsx` - добавлен индикатор статуса WebSocket соединения
- `ChatBox.tsx` - real-time сообщения и typing индикаторы
- `ChatBoxSendForm.tsx` - поддержка typing индикаторов

### 4. Интеграция с существующей архитектурой

- Использование существующих типов из `chatApi.ts`
- Интеграция с `chatStore` и `userStore`
- Fallback на API при отсутствии WebSocket соединения

## Настройка

### 1. Переменные окружения

Создайте файл `.env.local` в корне проекта:

```env
# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3000/chat

# Backend Configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

### 2. Аутентификация

WebSocket использует JWT токены для аутентификации. Токен извлекается из:

1. `localStorage.getItem('token')`
2. Cookies (если токен не найден в localStorage)

Убедитесь, что ваш бэкенд поддерживает JWT аутентификацию для WebSocket соединений.

### 3. Бэкенд требования

Ваш NestJS бэкенд должен поддерживать:

- Socket.IO с namespace `/chat`
- JWT аутентификацию через `auth.token`
- Следующие события:
  - `joinChatRoom`, `leaveChatRoom`
  - `sendMessage`, `newMessage`
  - `typing`, `userTyping`
  - `messageRead`
  - `createChatRoom`, `chatRoomCreated`
  - `updateChatRoom`, `chatRoomUpdated`
  - `addParticipants`, `participantsAdded`
  - `removeParticipant`, `participantRemoved`
  - `notification`, `roleBroadcast`

## Использование

### Базовое использование

```tsx
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";

function ChatComponent() {
  const {
    messages,
    sendMessage,
    isWebSocketConnected,
    webSocketMessages: { sendTyping, isTyping },
  } = useWebSocketChatSync();

  // Отправка сообщения через WebSocket (с fallback на API)
  const handleSendMessage = async (content: string) => {
    await sendMessage({ content });
  };

  // Отправка typing индикатора
  const handleTyping = (isTyping: boolean) => {
    sendTyping(isTyping);
  };

  return (
    <div>
      <div>Status: {isWebSocketConnected ? "Online" : "Offline"}</div>
      {/* Ваш UI */}
    </div>
  );
}
```

### Прямое использование WebSocket

```tsx
import { useWebSocket } from "@/context/WebSocketContext";

function MyComponent() {
  const { socket, isConnected, joinChatRoom, sendMessage } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      joinChatRoom("chat-room-id");
    }
  }, [isConnected, joinChatRoom]);

  const handleSend = () => {
    sendMessage({
      chatRoomId: "chat-room-id",
      content: "Hello!",
    });
  };

  return <button onClick={handleSend}>Send Message</button>;
}
```

## Особенности реализации

### 1. Автоматическое переподключение

- Экспоненциальная задержка (1s, 2s, 4s, 8s, 16s, 30s max)
- Максимум 5 попыток переподключения
- Автоматическое переподключение при потере соединения

### 2. Fallback на API

- При отсутствии WebSocket соединения используется обычный API
- Прозрачная интеграция с существующим `useChatSync`

### 3. Typing индикаторы

- Автоматическое отключение через 3 секунды
- Debouncing для предотвращения спама
- Визуальная анимация в UI

### 4. Синхронизация состояния

- Автоматическое добавление новых сообщений в store
- Обновление статуса чат-комнат в real-time
- Обработка ошибок и уведомлений

## Отладка

### 1. Проверка соединения

```tsx
import { useWebSocket } from "@/context/WebSocketContext";

function DebugComponent() {
  const { isConnected, socket } = useWebSocket();

  console.log("WebSocket connected:", isConnected);
  console.log("Socket instance:", socket);

  return <div>Status: {isConnected ? "Connected" : "Disconnected"}</div>;
}
```

### 2. Логирование событий

Все WebSocket события логируются в консоль для отладки.

### 3. Проверка токена

```javascript
// В консоли браузера
console.log("Token from localStorage:", localStorage.getItem("token"));
console.log("Cookies:", document.cookie);
```

## Производительность

### 1. Оптимизации

- Использование `useCallback` для стабильности ссылок
- Очистка таймаутов при размонтировании компонентов
- Мемоизация селекторов Zustand

### 2. Ограничения

- Максимум 5 попыток переподключения
- Таймаут соединения: 20 секунд
- Debouncing typing индикаторов: 3 секунды

## Безопасность

### 1. Аутентификация

- JWT токены для WebSocket соединений
- Автоматическое отключение при ошибках аутентификации

### 2. Валидация

- Все входящие данные проверяются
- Обработка ошибок на всех уровнях

## Тестирование

### 1. Unit тесты

```typescript
// Пример теста для WebSocket context
import { renderHook } from "@testing-library/react";
import { WebSocketProvider } from "@/context/WebSocketContext";

test("should connect with valid token", () => {
  const { result } = renderHook(() => useWebSocket(), {
    wrapper: WebSocketProvider,
  });

  act(() => {
    result.current.connect();
  });

  expect(result.current.isConnected).toBe(true);
});
```

### 2. Интеграционные тесты

- Тестирование полного цикла отправки сообщений
- Проверка переподключения
- Тестирование typing индикаторов

## Troubleshooting

### Частые проблемы

1. **WebSocket не подключается**
   - Проверьте `NEXT_PUBLIC_WS_URL` в `.env.local`
   - Убедитесь, что бэкенд запущен и поддерживает Socket.IO
   - Проверьте CORS настройки на бэкенде

2. **Сообщения не приходят**
   - Проверьте, что пользователь присоединен к чат-комнате
   - Убедитесь, что токен аутентификации валидный
   - Проверьте namespace `/chat` на бэкенде

3. **Typing индикаторы не работают**
   - Проверьте, что `sendTyping` вызывается при вводе
   - Убедитесь, что таймауты очищаются правильно

### Логи для отладки

Включите подробное логирование:

```typescript
// В WebSocketContext.tsx
const newSocket = io(wsUrl, {
  auth: { token },
  debug: true, // Включить debug логи
});
```

## Заключение

WebSocket интеграция полностью готова к использованию и интегрирована с существующей архитектурой проекта. Система обеспечивает надежную real-time функциональность с автоматическим восстановлением соединения и fallback на API при необходимости.
