import "reflect-metadata";
import * as dotenv from "dotenv";
import * as http from "http";
import * as WebSocket from "ws";
import app from "./app";
import { AppDataSource } from "./config/data-source";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000");
const WS_PORT = parseInt(process.env.WS_PORT || "3001");

async function bootstrap() {
  try {
    console.log(`[${new Date().toISOString()}] 正在初始化数据库连接...`);
    await AppDataSource.initialize();
    console.log(`[${new Date().toISOString()}] 数据库连接成功`);

    const server = http.createServer(app);

    if (process.env.ENABLE_WS === "true") {
      const wss = new WebSocket.Server({ port: WS_PORT });

      wss.on("connection", (ws: WebSocket) => {
        console.log(`[${new Date().toISOString()}] WebSocket客户端连接`);

        ws.on("message", (message: string) => {
          console.log(`[${new Date().toISOString()}] 收到WebSocket消息: ${message}`);
        });

        ws.on("close", () => {
          console.log(`[${new Date().toISOString()}] WebSocket客户端断开连接`);
        });

        ws.on("error", (error) => {
          console.error(`[${new Date().toISOString()}] WebSocket错误:`, error);
        });
      });

      console.log(`[${new Date().toISOString()}] WebSocket服务已启动，端口: ${WS_PORT}`);
    }

    server.listen(PORT, () => {
      console.log(`[${new Date().toISOString()}] ========================================`);
      console.log(`[${new Date().toISOString()}] 数字孪生城市地下管线管理后端服务`);
      console.log(`[${new Date().toISOString()}] ========================================`);
      console.log(`[${new Date().toISOString()}] 服务环境: ${process.env.NODE_ENV || "development"}`);
      console.log(`[${new Date().toISOString()}] HTTP服务端口: ${PORT}`);
      console.log(`[${new Date().toISOString()}] API根路径: http://localhost:${PORT}/api`);
      console.log(`[${new Date().toISOString()}] 健康检查: http://localhost:${PORT}/api/health`);
      if (process.env.ENABLE_WS === "true") {
        console.log(`[${new Date().toISOString()}] WebSocket端口: ${WS_PORT}`);
      }
      console.log(`[${new Date().toISOString()}] ========================================`);
      console.log(`[${new Date().toISOString()}] 服务启动成功！`);
      console.log(`[${new Date().toISOString()}] ========================================`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          console.error(`[${new Date().toISOString()}] 端口 ${PORT} 需要更高权限`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          console.error(`[${new Date().toISOString()}] 端口 ${PORT} 已被占用`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    process.on("SIGTERM", () => {
      console.log(`[${new Date().toISOString()}] 收到SIGTERM信号，正在关闭服务...`);
      server.close(() => {
        console.log(`[${new Date().toISOString()}] HTTP服务已关闭`);
        AppDataSource.destroy().then(() => {
          console.log(`[${new Date().toISOString()}] 数据库连接已关闭`);
          process.exit(0);
        });
      });
    });

    process.on("SIGINT", () => {
      console.log(`[${new Date().toISOString()}] 收到SIGINT信号，正在关闭服务...`);
      server.close(() => {
        console.log(`[${new Date().toISOString()}] HTTP服务已关闭`);
        AppDataSource.destroy().then(() => {
          console.log(`[${new Date().toISOString()}] 数据库连接已关闭`);
          process.exit(0);
        });
      });
    });

    process.on("uncaughtException", (error) => {
      console.error(`[${new Date().toISOString()}] 未捕获的异常:`, error);
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error(`[${new Date().toISOString()}] 未处理的Promise拒绝:`, reason);
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 服务启动失败:`, error);
    process.exit(1);
  }
}

bootstrap();
