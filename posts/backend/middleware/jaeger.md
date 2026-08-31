---
title: Jaeger 介绍
date: 2026-04-10
order: 1
---

### Jaeger 介绍

Jaeger 是一个分布式链路追踪系统，可以映射分布式系统中的请求流和数据流。这些请求可能会调用多个服务，而这些服务可能会带来各自的延迟或错误。Jaeger 将这些不同组件之间的点连接起来，帮助识别性能瓶颈、排除故障并提高整体应用程序的可靠性

Jaeger 用于监控基于微服务的分布式系统：

- 分布式上下文传递
- 分布式事务监听
- 根因分析
- 服务依赖性分析
- 性能/延迟优化

### 三个核心概念

#### Trace

一次完整请求的全链路记录就是一个 trace

#### Span

trace 中的一个步骤就是一个 span，一次 RPC、一次数据库查询、一次内部处理阶段，都是一个 span

#### Context Propagation

上下文传播就是把 trace id、span id 这些信息随着请求在服务之间传递下去。 如果上下文断了，整条链路也就断了

### 和 Dapper 的关系

现代分布式追踪系统的很多核心思想，都能追溯到 Google 的经典论文《Dapper, a Large-Scale Distributed Systems Tracing Infrastructure》

Dapper 的核心贡献不只是提出了 `trace` 和 `span`，更使得**分布式追踪可以在超大规模生产环境里长期打开，并且把性能影响控制在足够低的范围内**

Dapper 论文里强调了以下几点：

- 链路追踪要尽量对业务透明，最好把植入点放在 RPC、线程模型、异步框架这些公共基础设施里
- tracing 必须控制开销，所以采样是大规模部署的前提
- trace 数据应该开放成平台，支持查询、分析和统计

### 本地启动 Jaeger

本地调试最简单的方式是跑 Jaeger all-in-one：

```bash
docker run --rm --name jaeger \
  -e COLLECTOR_ZIPKIN_HOST_PORT=:9411 \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 5778:5778 \
  -p 16686:16686 \
  -p 4317:4317 \
  -p 4318:4318 \
  -p 14250:14250 \
  -p 14268:14268 \
  -p 14269:14269 \
  -p 9411:9411 \
  jaegertracing/all-in-one:1.55
```

启动后常用的几个端口如下：

- `16686`：Jaeger UI
- `14269`：健康检查
- `4317`：OTLP gRPC
- `4318`：OTLP HTTP
- `9411`：Zipkin 兼容入口

可以先访问：

```bash
curl http://localhost:14269/
```

以及：

```text
http://localhost:16686
```

### Go 示例

现在假设 Jaeger 已经在本地跑起来了，我们用一个最小 Go 程序，把一条 trace 发进去

`main.go`

```go
package main

import (
	"context"
	"log"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	// 创建根上下文
	ctx := context.Background()

	// 创建 OTLP exporter
	exp, err := otlptracegrpc.New(
		ctx,
		otlptracegrpc.WithEndpoint("localhost:4317"),
		otlptracegrpc.WithTLSCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatal(err)
	}

	// 创建 TracerProvider，tracing 的核心配置
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(
			resource.NewWithAttributes(
				"",
				attribute.String("service.name", "demo-api"),
			),
		),
	)
	defer func() {
		_ = tp.Shutdown(context.Background())
	}()

	// 注册全局 TracerProvider，并拿到 tracer
	otel.SetTracerProvider(tp)
	tracer := otel.Tracer("demo-tracer")

	// 创建根 span
	ctx, span := tracer.Start(ctx, "http.request")
	time.Sleep(120 * time.Millisecond)

	// 创建子 span
	_, child := tracer.Start(ctx, "db.query")
	time.Sleep(60 * time.Millisecond)
	child.End()

	// 结束 span
	span.End()

	log.Println("trace sent")
}
```

运行这个示例

```bash
mkdir jaeger-demo
cd jaeger-demo
go mod init jaeger-demo
go get go.opentelemetry.io/otel \
  go.opentelemetry.io/otel/sdk \
  go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc \
  google.golang.org/grpc
go run .
```

运行完成后，打开：

```text
http://localhost:16686
```

在 Jaeger UI 里选择服务：

```text
demo-api
```

然后点击 `Find Traces`，你会看到一条 trace，里面至少有两个 span：

- `http.request`
- `db.query`

它们的父子关系大概如下：

```text
trace
└── http.request
    └── db.query
```

这个最小程序虽然很短，但已经覆盖了 tracing 最核心的流程：

1. 创建 exporter
2. 创建 provider
3. 注册 tracer
4. 创建 span
5. 通过 context 建立父子关系
6. 在退出前 flush 数据

## 总结

Jaeger 背后的核心思想继承自 Dapper，随着 OpenTelemetry 的稳步发展，Jaeger 更倾向于遵循 OpenTelemetry 规范，并把精力集中在构建跟踪后端、可视化工具和数据挖掘技术上。作为普通开发者，使用 OpenTelemetry SDK + Jaeger 将是分布式追踪的理想方案
