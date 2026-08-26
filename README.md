# BetterNCM-6K-Labs

![preview](./preview.png)  
_preview image from [6K Labs](https://6klabs.com/)_

Powered by a Rust native cache server and [InfLink-rs](https://github.com/apoint123/inflink-rs).

Inspired by [Widdit/now-playing-service](https://github.com/Widdit/now-playing-service)

## V1 Update

通过 AI 的帮助，我把 HTTP 服务器的实现方案换成了注入网易云进程中的 Rust 程序，现在不需要再去起一个外部进程且在 BetterNCM 中这么受限的 API 中去管理它了。可能减少了一点资源占用，减少了一点 Bug，提高了一些可维护性喵~

同时把数据源换成了 InfLink-rs，借助它的帮助，我们更轻松地适配了 v3 新版客户端喵~
