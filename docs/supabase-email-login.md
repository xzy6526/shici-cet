# 配置 Supabase 邮箱验证码登录

项目已经实现邮箱验证码登录和本地学习数据合并。完成下面配置后，登录会使用真实 Supabase 服务；未配置时，网站保持游客模式，不会伪造登录成功。

## 1. 创建或选择 Supabase 项目

进入 Supabase Dashboard，创建一个项目或选择已有项目。

在 **Project Settings → API** 复制以下两项：

- Project URL
- Publishable key（旧项目界面可能显示为 `anon public` key）

不要使用或分享 `service_role` key。它拥有绕过行级安全策略的权限，绝不能写入浏览器、GitHub Pages 或 `.env.local`。

## 2. 创建数据表和访问策略

在 **SQL Editor** 打开新查询，将项目中的 [202609060001_user_learning_state.sql](../supabase/migrations/202609060001_user_learning_state.sql) 全部内容粘贴并运行。

这会创建用户资料、偏好和单词学习状态表，并启用“用户只能读写自己的数据”的行级安全策略。

## 3. 启用邮箱验证码

在 **Authentication → Providers → Email** 确认 Email 已启用。

在 **Authentication → URL Configuration** 设置：

- Site URL：`https://xzy6526.github.io/shici-cet/`
- Redirect URLs：添加 `https://xzy6526.github.io/shici-cet/` 和本地开发地址 `http://127.0.0.1:5173/`

正式试用建议在 **Authentication → SMTP Settings** 配置自己的 SMTP 服务。Supabase 默认邮件服务存在发送频率与收件限制，不适合多人长期试用。

## 4. 配置本地开发

复制 `.env.example` 为 `.env.local`，填入：

```env
VITE_SUPABASE_URL=https://你的项目引用.supabase.co
VITE_SUPABASE_ANON_KEY=你的 publishable 或 anon public key
```

`.env.local` 已被 Git 忽略，不会提交到仓库。重启本地站点后，点击“我的 → 登录并同步”，输入邮箱并验证收到的六码验证码。

## 5. 配置 GitHub Pages

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 新建两个 Repository secrets：

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable key 或 anon public key |

部署工作流会在构建时生成 `runtime-config.js`。这两项是浏览器连接 Supabase 所必需的公开配置；数据安全依赖第 2 步创建的 RLS 策略。不要将 service role key 添加为 Secret 或写入运行时配置。

添加 Secrets 后重新运行 GitHub Pages workflow，打开线上“我的”页完成一次邮箱验证码登录。首次登录会保留当前设备的本地学习记录，并在后台合并到该账号。

## 验收清单

- 邮箱格式不正确时不会发送验证码。
- 收到验证码后可以登录或自动创建账号。
- 登录前的学习进度、收藏与设置仍然存在。
- 刷新页面后登录状态保持。
- 退出登录后，本地学习功能仍可使用。
