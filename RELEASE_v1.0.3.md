# Hướng Dẫn Tải Lên GitHub Release & Giới Thiệu Các Bản Build v1.0.3

Tài liệu này cung cấp toàn bộ nội dung ghi chú phát hành (Release Notes) và danh sách tệp đính kèm cần tải lên (upload) cho phiên bản **v1.0.3** trên GitHub: [https://github.com/qtu11/DeepSeek-Harness-Ds2api/releases/new](https://github.com/qtu11/DeepSeek-Harness-Ds2api/releases/new).

---

## 1. Nội Dung Sao Chép Nhanh Vào Ô "Release Notes" Trên GitHub

Chủ tịch có thể sao chép toàn bộ đoạn văn bản bên dưới và dán trực tiếp vào ô **Release notes** trên trình duyệt:

```markdown
Phiên bản **v1.0.3** là bản cập nhật đột phá toàn diện, biến DeepSeek thành một Siêu Trợ Lý AI (Super Agent) tích hợp đầy đủ khả năng: **Bộ nhớ dài hạn vĩnh viễn từng project (MemOS 2.0 + RAG BM25), chuỗi suy luận sâu DeepThink (CoT stream), Trình thông dịch Python Code Interpreter, Bóc tách nội dung Web ngữ nghĩa, Tự động hóa trình duyệt với cơ chế thị giác Set-of-Mark, Điều khiển Selenium PowerShell native, Điều phối Multi-Agent/Subagents, Lập kế hoạch Plan Mode, Quy trình Workflows DAG, và Cầu nối DS2API tự động 100% kèm ứng dụng Desktop Windows Native 1-Click (`DeepSeek Harness.exe`)**.

---

### 🚀 Các Năng Lực & Tiện Ích Đột Phá Trong v1.0.3:

1. **Bộ Nhớ Dài Hạn Vĩnh Viễn Từng Project (MemOS 2.0 & RAG BM25)**:
   - Tích hợp MemOS 2.0 Local Engine với bộ nhớ đa lớp (L1/L2/L3) kèm Web Viewer trên cổng `18801`.
   - Tool `rag_search`: Tìm kiếm ngữ nghĩa văn bản và mã nguồn theo thuật toán xếp hạng BM25 (Robertson-Spärck Jones IDF).
   - Tool `doc_parse`: Phân tích và chunking tài liệu lớn theo cấu trúc dòng và vùng đệm an toàn.
   - Lưu trữ và khôi phục trạng thái phiên qua JSONL Persistence version 0.

2. **Chuỗi Suy Luận Sâu DeepThink (CoT Stream)**:
   - Tách luồng `reasoning_content` delta tự động thành khối suy luận riêng biệt (`reasoning block`).
   - Tùy chỉnh mức độ nỗ lực suy luận (`Reasoning Effort`): `off`, `low`, `high`, `max`.

3. **Trình Thông Dịch Python Code Interpreter (`@deepseek-ai/dsh-tool-python-interpreter`)**:
   - Tool `python_execute`: Thực thi mã Python cục bộ, xử lý tính toán, phân tích dữ liệu (pandas, numpy) và vẽ đồ thị.

4. **Bóc Tách Nội Dung Web Ngữ Nghĩa (`@deepseek-ai/dsh-tool-web-extractor`)**:
   - Tool `web_extract`: Tải và làm sạch HTML, loại bỏ quảng cáo/scripts và chuyển đổi sang Markdown chuẩn.

5. **Tự Động Hóa Trình Duyệt Đa Tầng & Thị Giác Set-of-Mark (`@deepseek-ai/dsh-tool-browser`)**:
   - Điều khiển Chrome/Edge (Headless và Desktop GUI): `browser_navigate`, `browser_click`, `browser_type`, `browser_screenshot`, `browser_content`, `browser_eval`, `browser_close`.
   - Cơ chế Set-of-Mark (`browser_highlight` / `highlightElements: true`): Tự động đánh số `[1]`, `[2]`, `[3]` lên các phần tử tương tác phục vụ Vision AI.

6. **Điều Khiển Selenium Native PowerShell (`@deepseek-ai/dsh-tool-selenium`)**:
   - Tool `selenium_execute`: Chạy kịch bản tự động hóa trình duyệt qua module Selenium PowerShell có sẵn.

7. **Quản Lý Task Nền, Lập Lịch & Workflows DAG**:
   - `tool-jobs`: Quản lý tiến trình chạy ngầm, theo dõi tiến độ, gửi stdin và dừng task.
   - `dsh-schedule`: Lập lịch hẹn giờ (Timer) và cron định kỳ.
   - `tool-subagent` & `tool-workflow`: Điều phối subagents swarm và Ralphinho DAG pipeline.

8. **Cầu Nối DS2API Proxy Tự Động 100% & Ứng Dụng Desktop 1-Click**:
   - Sử dụng tài khoản Web `chat.deepseek.com` miễn phí dưới dạng chuẩn OpenAI API với PoW Solver Go nội bộ.
   - Khởi chạy toàn bộ hệ thống bằng 1 cú nhấp chuột qua `DeepSeek Harness.exe`.
```

---

## 2. Danh Sách Các Tệp Cần Tải Lên (Attach Binaries) Lên GitHub Release

Tất cả các tệp nén và binary độc lập đã được tạo sẵn trong thư mục `dist-release/` tại máy của chủ tịch:

| Tên Tệp (Trong `dist-release/`) | Hệ Điều Hành & Kiến Trúc | Mục Đích Sử Dụng | Mức Độ Khuyên Dùng |
| :--- | :--- | :--- | :---: |
| **`DeepSeek-Harness-v1.0.3-Windows-x64.zip`** | Windows 10/11 (64-bit) | Bản cài đặt/chạy Portable đầy đủ giao diện Desktop Electron cho Windows. | **Bắt buộc (Khuyên dùng nhất)** |
| **`DeepSeek-Harness-v1.0.3-macOS-arm64.zip`** | macOS (Apple Silicon M1/M2/M3/M4) | Gói ứng dụng `DeepSeek Harness.app` kèm launcher 1-Click cho máy Mac đời mới. | **Bắt buộc cho macOS** |
| **`DeepSeek-Harness-v1.0.3-macOS-x64.zip`** | macOS (Intel x86_64) | Gói ứng dụng `DeepSeek Harness.app` kèm launcher 1-Click cho máy Mac Intel. | **Tùy chọn** |
| **`DeepSeek-Harness-v1.0.3-Linux-x64.zip`** | Linux (Ubuntu, Debian, Fedora, Arch x64) | Gói ứng dụng Desktop Electron độc lập cho Linux x86_64. | **Bắt buộc cho Linux** |
| **`DeepSeek-Harness-v1.0.3-Linux-arm64.zip`** | Linux (Raspberry Pi 4/5, Server ARM64) | Gói ứng dụng Desktop Electron cho Linux ARM64. | **Tùy chọn** |
| **`DeepSeek-Harness-Windows-1Click-Launcher.exe`** | Windows (x64) | Trình khởi chạy nhị phân siêu nhẹ (~2.7 MB) đặt tại thư mục dự án. | **Khuyên dùng** |
| **`ds2api-v1.0.3-windows-amd64.exe`** | Windows (x64) | Cầu nối DS2API Proxy độc lập (Stand-alone service) cho Windows. | **Tùy chọn** |
| **`ds2api-v1.0.3-linux-amd64`** | Linux (x64) | Cầu nối DS2API Proxy độc lập cho Linux Server. | **Tùy chọn** |
| **`ds2api-v1.0.3-darwin-arm64`** | macOS (Apple Silicon) | Cầu nối DS2API Proxy độc lập cho macOS. | **Tùy chọn** |

---

## 3. Các Bước Thao Tác Tải Lên Trên Giao Diện GitHub

1. **Tag version**: Chọn `v1.0.3` (Target: `main`).
2. **Release title**: Điền `v1.0.3` hoặc `DeepSeek Harness v1.0.3 - Siêu Trợ Lý AI Toàn Năng (Full Capabilities)`.
3. **Release notes**: Dán nội dung ở **Mục 1** vào ô văn bản.
4. **Attach binaries**:
   - Mở thư mục `dist-release` trên máy tính: `C:\Users\KIMPC\Desktop\deepseek harness\dist-release`.
   - Kéo thả (Drag & Drop) các tệp `.zip` và `.exe` ở **Mục 2** vào vùng **"Attach binaries by dropping them here or selecting them"**.
5. Nhấn nút **"Publish release"** ở cuối trang để hoàn tất công bố phiên bản.
