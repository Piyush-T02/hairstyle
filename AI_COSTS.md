# StrandAI — AI Image Processing Pricing & Quality Matrix

**Report by:** Piyush Tiwari  
**Date:** June 2026  
**Target:** Technical Teams, Shareholders, and Clients  

---

## 📋 What It Is About
This report outlines the structural costs and quality trade-offs associated with the image processing models integrated into the StrandAI try-on system. The analysis evaluates two primary model configurations: **chatgpt-image-1** and **gemini-flash-2.0 (nano one)**. By structuring the models into clear Quality Tiers (Premium, Standard, and Economy), this document provides the metrics needed to balance operational budgets with desired customer experience.

---

## 🏗️ How It Works
Each time a user requests a hairstyle try-on, the application transfers the photo to the secure backend API. The backend processes the image, segments the hair using neural segmentation, and makes exactly **one API call** to the selected AI model to generate the new hairstyle. 

Because billing is calculated strictly per image, total operational costs scale proportionally with user transactions:
$$\text{Total Cost} = \text{Cost per Image} \times \text{Total User Transactions}$$

---

## 🔍 Quality & Output Overview (Which is Best?)
For hairstyle try-ons where face, background, and clothing must remain identical to the original image, **chatgpt-image-1 (High and Medium Quality) is technically the best choice**. It utilizes strict alpha transparency masking, which guarantees that non-hair regions remain 100% untouched.

In contrast, **gemini-flash-2.0 (nano one)** uses reference-guided prompt inpainting. While significantly cheaper and faster, it relies on AI alignment rather than hard boundaries, which can cause subtle unwanted mutations in adjacent facial features or background pixels. However, ChatGPT's superior quality comes at a premium, costing up to 4x to 8x more per image than Gemini.

---

## 📊 Cost & Quality Comparison Matrix

| Quality Tier | Model Configuration | Cost / Image | Quality Characteristics & Target Output | Mask / Edit Support |
| :--- | :--- | :--- | :--- | :--- |
| **Premium Quality** *(Best / Ultra)* | `chatgpt-image-1` (High) | **$0.1670** | Highest fidelity hair strands and textures; seamless hairline blending; zero noise in background. | Yes (Pixel-perfect hair mask) |
| **Premium Quality** *(Best / Ultra)* | `gemini-flash-2.0 (nano one)` (Ultra) | **$0.0400** | Excellent photorealistic hair rendering; very clean borders; high processing speed. | Yes (Reference-guided mask) |
| **Standard Quality** *(Balanced / Medium)* | `chatgpt-image-1` (Medium) | **$0.0420** | Good balance of hair detail and processing speed; minimal artifacts under standard lighting. | Yes (Pixel-perfect hair mask) |
| **Standard Quality** *(Balanced / Medium)* | `gemini-flash-2.0 (nano one)` (Standard) | **$0.0200** | Standard photorealism; fast response time; slight boundary transitions in high-contrast images. | Yes (Reference-guided mask) |
| **Economy Quality** *(Low / Fast)* | `chatgpt-image-1` (Low) | **$0.0110** | Faster response times; lower resolution preview; minor loss in fine hair strand definition. | Yes (Pixel-perfect hair mask) |
| **Economy Quality** *(Low / Fast)* | `gemini-flash-2.0 (nano one)` (Fast) | **$0.0195** | Highly optimized for speed; lower resource usage; suitable for quick draft/mockup views. | Yes (Reference-guided mask) |

---

## 📈 Projected Monthly Volume Costs

Estimates are based on user transactions (1 API call per try-on generation).

| Model Configuration | Cost / Image | 1,000 Images / mo | 5,000 Images / mo | 10,000 Images / mo | 15,000 Images / mo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `chatgpt-image-1` (High) | **$0.1670** | $167.00 | $835.00 | $1,670.00 | $2,505.00 |
| `gemini-flash-2.0 (nano one)` (Ultra) | **$0.0400** | $40.00 | $200.00 | $400.00 | $600.00 |
| `chatgpt-image-1` (Medium) | **$0.0420** | $42.00 | $210.00 | $420.00 | $630.00 |
| `gemini-flash-2.0 (nano one)` (Standard) | **$0.0200** | $20.00 | $100.00 | $200.00 | $300.00 |
| `chatgpt-image-1` (Low) | **$0.0110** | $11.00 | $55.00 | $110.00 | $165.00 |
| `gemini-flash-2.0 (nano one)` (Fast) | **$0.0195** | $19.50 | $97.50 | $195.00 | $292.50 |

---

## ⚠️ Google Cloud Free Credit Caveats & Quality Issues

While Google Cloud provides **$300 in free startup credits** (which covers about 15,000 images at Standard quality), there are several severe limitations and quality risks that make it unsuitable for production:
1. **High Risk of Hallucinations & Improper Results:** Free/trial model configurations are highly prone to hairstyle hallucinations, visual artifacts, and unnatural rendering. Relying on these free tiers in a live environment results in low-quality and inconsistent outputs that can severely damage the brand name and user trust.
2. **New Account Restriction:** The credit only applies to newly created Google Cloud billing profiles.

---

## 🚀 Optimal Production Recommendations (Best Usage)

For optimal production usage, we recommend focusing on the **Standard Quality Tier** configurations. Specifically, **gemini-flash-2.0 (Standard)** and **chatgpt-image-1 (Medium)** represent the ideal equilibrium of visual fidelity, response speed, and cost efficiency. Depending on your business goals, the following configurations are recommended:

* **chatgpt-image-1 (Medium) — Premium Production ($0.0420 / image):** This configuration is highly recommended for client-facing final renders. Because it utilizes strict transparent masking, it ensures 100% boundary preservation of the face, neck, clothing, and background. This is the optimal configuration for a premium, artifact-free customer experience.
* **gemini-flash-2.0 (Standard) — High-Volume / Draft Mode ($0.0200 / image):** This configuration is recommended for rapid previews, interactive style explorations, or high-volume traffic. It reduces the per-image cost by over 50% compared to ChatGPT while maintaining standard photorealism.

---
*Generated Report: A PDF copy of this matrix has been compiled and saved as `AI_COSTS.pdf`.*
