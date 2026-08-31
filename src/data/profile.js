// Shared profile data — consumed by the Home dashboard and other profile UI,
// so project/skill edits only need to happen in one place.
import { withBasePath } from "../lib/paths";

export const GITHUB = "https://github.com/qiqi776";
export const EMAIL = "mailto:2211546824@qq.com";
// Self-hosted copy of the GitHub avatar rather than the `github.com/<user>.png`
// redirect. Same reasoning as the fonts: an external request on every page load
// is a third-party dependency for something that never changes, and GitHub's
// avatar CDN is not reliably fast from mainland China. Regenerate with:
//   curl -sL https://github.com/qiqi776.png?size=400 -o /tmp/a.jpg
//   convert /tmp/a.jpg -resize 200x200 -quality 85 public/avatar.jpg
// 200px covers both display sizes at 2x DPR (36px navbar, 80px profile card).
// JPEG, not PNG: it's a photo, and q85 is 13.5 KB against PNG24's 79.7 KB.
export const AVATAR = withBasePath("/avatar.jpg");
export const HANDLE = "追忆成空";
export const DISPLAY_NAME = "追忆成空";

export const projects = [
  {
    name: "zfeed",
    lang: "Go",
    langColor: "#00ADD8",
    desc: "基于微服务架构的社区信息流系统，涵盖内容发布、推荐/关注流、搜索、互动计数等完整服务链路。",
    stars: 4,
    forks: 1,
    href: "https://github.com/qiqi776/zfeed",
    tags: ["Go", "gRPC", "Kafka"],
  },
  {
    name: "mini-kv",
    lang: "Go",
    langColor: "#00ADD8",
    desc: "基于 Raft 共识算法实现的分布式键值存储系统。",
    stars: 3,
    forks: 0,
    href: "https://github.com/qiqi776/mini-kv",
    tags: ["Go", "Raft", "BoltDB"],
  },
  {
    name: "tinykv",
    lang: "Go",
    langColor: "#00ADD8",
    desc: "TalentPlan TinyKV 课程实现——从零构建分布式 KV 存储。",
    stars: 1,
    forks: 0,
    href: "https://github.com/qiqi776/tinykv",
    tags: ["Go", "Raft", "MVCC"],
  },
  {
    name: "my-rag-agent",
    lang: "Python",
    langColor: "#3776AB",
    desc: "RAG 学习项目，探索大模型检索增强生成技术。",
    stars: 1,
    forks: 0,
    href: "https://github.com/qiqi776/my-rag-agent",
    tags: ["Python", "LLM", "RAG"],
  },
  {
    name: "cs144",
    lang: "C++",
    langColor: "#f34b7d",
    desc: "Stanford CS144 计算机网络课程实验——实现 TCP/IP 协议栈。",
    stars: 1,
    forks: 0,
    href: "https://github.com/qiqi776/cs144",
    tags: ["C++", "TCP/IP"],
  },
  {
    name: "my-blog",
    lang: "Vue",
    langColor: "#42b883",
    desc: "早期个人博客项目，Vue 技术栈构建。",
    stars: 3,
    forks: 0,
    href: "https://github.com/qiqi776/my-blog",
    tags: ["Vue3", "VitePress"],
  },
];

export const skills = [
  { label: "Go", level: 88 },
  { label: "分布式系统", level: 80 },
  { label: "Python", level: 68 },
  { label: "Vue / 前端", level: 65 },
  { label: "C++ / 系统编程", level: 60 },
  { label: "MySQL / Redis / MQ", level: 75 },
];

export const langColors = {
  Go: "#00ADD8",
  Python: "#3776AB",
  Vue: "#42b883",
  "C++": "#f34b7d",
};
