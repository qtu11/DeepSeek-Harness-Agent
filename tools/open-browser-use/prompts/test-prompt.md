# **OpenBrowser Use Test Prompt Suite**

This document contains 14 browser automation test tasks for evaluating an `openbrowser use` tool.

The tasks are intentionally **interaction-heavy**. Each one now requires **deep, multi-step browser manipulation** — not just searching and reading. The point is to exercise the tool against the controls that real websites actually expose: nested dropdowns, expandable accordions, modal dialogs, hover-reveal tooltips, sort and filter menus, sliders, image galleries, tab drill-downs, pagination, and long chains of clicks and back-navigation.

The tasks are designed to test both:

1. **Page operations** — opening websites, searching, clicking deep into UI controls, expanding collapsed content, operating dropdown / sort / filter menus, dragging sliders, toggling views, opening and closing modals and overlays, hovering to reveal data, switching tabs, paginating, and chaining many navigation steps together.
2. **Information extraction** — reading structured and unstructured webpage content, extracting key fields, summarizing text, comparing items, and reporting limitations.

Do **not** perform actions that change account state, such as logging in, purchasing items, submitting forms, posting comments, sending messages, or making reservations. **Every interaction required below is read-only**: opening menus, expanding sections, dragging filter sliders, applying client-side sorts/filters, switching tabs, and dismissing overlays are all allowed because they do not commit a change. Stop short of any button that submits, purchases, books, posts, or signs in.

---

# **Global Testing Instructions**

Use the following instructions for every task:

```text
Use the openbrowser use tool to complete the web task below.

Requirements:
1. Follow the steps in order as much as possible.
2. Page operations and information extraction are equally important.
3. Each task deliberately requires complex, multi-step interactions (menus,
   dropdowns, accordions, modals, tabs, sliders, sorting, dynamic filters,
   hover-reveals, pagination). Actually PERFORM these interactions — do not
   read only the initial page state.
4. If a control (filter, sort, dropdown, modal, tab, slider, gallery) is
   present, open and operate it even if the data could be obtained without it.
   The interaction itself is what is being tested.
5. Do not skip required page interactions unless the page blocks access.
6. If you encounter a popup, cookie banner, login wall, subscription wall,
   CAPTCHA, regional restriction, or page-loading failure, record the specific
   blocker. Where an overlay can be dismissed without logging in, dismiss it
   and continue.
7. If one step cannot be completed, continue with later steps that are still
   possible.
8. Do not log in, create an account, purchase anything, submit comments, send
   messages, make a reservation, or perform any action that changes account
   state. Opening menus, expanding content, dragging sliders, and applying
   client-side filters/sorts are allowed because they do not change account
   state.
9. Return the final answer in a structured format.
10. For every extracted field, include the source page or URL where it was
    found.
11. Record each non-trivial interaction (what you clicked, which
    menu/dropdown/modal/tab you opened, which slider or filter you set) in the
    Page Operation Results.
12. Include the final URL reached at the end.
```

Recommended output format:

```text
Task Name:
Target Website:
Final Status: Success / Partial Success / Failed

Execution Steps:
1. ...
2. ...
3. ...

Extracted Information:
- Field 1:
- Field 2:
- Field 3:

Page Operation Results:
- Search completed:
- Filters applied:
- Sorting applied:
- Menus/dropdowns opened:
- Accordions/sections expanded:
- Modals/overlays opened (and closed):
- Tabs switched:
- Sliders/range controls set:
- Pagination performed:
- Clicks/navigation completed:
- Popup/login wall/CAPTCHA encountered:
- Manual intervention required:

Final URL:
Notes:
```

---

# **1. Google — Search, Tools Filtering, PAA Accordions, and Secondary Search**

**Difficulty: Hard**

## **Task**

Open Google and complete the following steps:

1. Search for the keyword: `OpenAI latest model`.
2. Read the first page of search results.
3. Extract the top 5 organic search results. For each result, extract:
   * Result title
   * Source website
   * Short snippet
   * Page URL
4. Open the **Tools** menu beneath the search bar, open the time dropdown, and apply **Past year**. Record the top organic result *before* and *after* the filter to show the result set changed.
5. Expand the first **People also ask** question (click it open) and read the revealed answer. Extract the question text and a one-line summary of the answer.
6. Switch to the **News** tab in the result-type bar, note the top news headline, then switch back to the **All** tab.
7. Identify the result most likely from an official source and click it.
8. On the destination page, look for information related to `model`, `release`, or `announcement`. Extract:
   * Page title
   * Source organization
   * 3 key points related to the model or release
   * Current page URL
9. Use browser back-navigation to return to the Google results page.
10. Scroll to the bottom and click one entry under **Related searches**; record the new query that loads.
11. Now search again for: `OpenAI API pricing`.
12. Re-open the **Tools** menu and **clear** any active time filter so the results are unfiltered again.
13. Find the official pricing page and open it. Extract:
    * Page title
    * Whether pricing, price, or cost information appears on the page
    * Current page URL

## **Expected Capabilities Tested**

* Web search
* Operating the Tools menu and time-range dropdown
* Re-querying after a filter is applied vs cleared
* Expanding "People also ask" accordions
* Switching between result-type tabs (All / News)
* Identifying organic results and avoiding ads
* Opening results and reading destination pages
* Back-navigation and using "Related searches"
* Performing a second search and clearing prior filters
* Extracting structured information across multiple pages

---

# **2. Wikipedia — TOC Navigation, Collapsible Infoboxes, and Citation Jumps**

**Difficulty: Medium-Hard**

## **Task**

Open Wikipedia and complete the following steps:

1. Search for `Alan Turing`.
2. Open the Alan Turing article.
3. Extract from the infobox:
   * Date of birth
   * Place of birth
   * Date of death
   * Main research fields
   * Major contributions
4. Use the **table of contents** (sidebar or top-of-page contents) to jump directly to a section such as `Cryptanalysis`; extract one fact from that section.
5. If the infobox or any sidebar has a collapsed row/section with a **[show]** control, expand it and read the revealed value.
6. Open the **Languages** control and record how many languages the article is available in. Do **not** switch language — only inspect the count.
7. In the article body, find a link related to `Turing machine`.
8. Click the `Turing machine` link.
9. On the Turing machine page, extract:
   * The first sentence defining the concept
   * The academic or technical field the concept belongs to
   * Whether Alan Turing is mentioned on the page
10. Click an inline **citation/reference number** (e.g. `[1]`) to jump to the references list; record the cited source title, then use the back-to-text link to jump back into the body.
11. Use browser back-navigation to return to the Alan Turing page.
12. Use the table of contents to jump to a `Legacy`, `Recognition`, or similarly named section.
13. Extract 3 facts from that section related to Alan Turing's legacy, recognition, or influence.

## **Expected Capabilities Tested**

* Site search
* Table-of-contents jump navigation in long pages
* Expanding collapsible infobox / sidebar sections
* Inspecting the language menu without changing language
* Clicking internal links
* Citation jump-and-return within a page
* Back-navigation between articles
* Reading encyclopedia infoboxes and body text
* Combining information from multiple pages

---

# **3. YouTube — Filter Menu, Sort Dropdown, Channel Drill-Down, and Comment Sorting**

**Difficulty: Hard**

## **Task**

Open YouTube and complete the following steps:

1. Search for `Python tutorial for beginners`.
2. Open the **Filters** menu and apply:
   * Type: Video
   * Duration: Over 20 minutes
3. In the same Filters panel, also apply **Sort by: View count** (highest first).
4. From the search results, open a video with a high view count.
5. Extract:
   * Video title
   * Channel name
   * Publish date
   * View count
   * Video duration
   * First 3 visible lines of the description
6. Click **…more** to expand the full description; record whether chapters/timestamps or external links are present.
7. Click the **channel name** to open the channel page; extract the subscriber count and any visible "About"/join info, then return to the video.
8. Scroll to the comments section. Open the comments **Sort by** dropdown and switch to **Top comments**.
9. Read the first 3 comments after sorting and summarize each briefly.
10. Use back-navigation to return to the search results page.
11. Find another video from a **different channel**. Extract:
    * Video title
    * Channel name
    * View count
12. Compare the two videos and state which appears more suitable for beginners, based only on visible information.

## **Expected Capabilities Tested**

* Search
* Opening and applying the Filters menu (type + duration)
* Operating the Sort-by dropdown
* Expanding a truncated description
* Drilling into a channel page and returning
* Switching comment sort order via dropdown
* Scrolling and reading comments
* Back-navigation to results
* Comparing multiple items

---

# **4. GitHub — Sort Dropdown, File-Tree Drill-Down, Branch/Tag Switching, and Label Filters**

**Difficulty: Hard**

## **Task**

Open GitHub and complete the following steps:

1. Search for `langchain`.
2. On the results page, open the **Sort** dropdown and change it from "Best match" to **Most stars**, then select the most relevant official/primary repository.
3. Open the repository page and extract:
   * Repository name
   * Owner name
   * Stars count
   * Forks count
   * Main programming language
   * License type
4. Drill into the repository **file tree**: open a subfolder, then open a source file, and record the file path plus its first heading or line.
5. Open the **branch/tag dropdown** ("Switch branches/tags") and switch to the **Tags** view; record the latest tag name. (Inspect only — do not create or change anything.)
6. Return to the default branch and read the top portion of the README. Extract:
   * One-sentence project description
   * Main use case
   * Installation command, if visible
7. Open the **Issues** tab. Make sure open issues are shown.
8. Use the **label filter** (open the Labels dropdown, or click a label chip) to filter open issues by one chosen label; record which label you used.
9. Extract the first 3 visible open issues:
   * Issue title
   * Issue number
   * Labels
   * Created date or last updated date
10. Open the **Insights** tab → **Contributors**; record the top contributor's username.
11. Return to the repository homepage. Open the **Releases** or **Tags** page and extract:
    * Latest release or tag name
    * Release or tag date, if visible
12. Return the final structured result with the current page URL.

## **Expected Capabilities Tested**

* Site search and the search Sort dropdown
* Repository identification
* Reading repository metadata
* File-tree drill-down (folder → file)
* Operating the branch/tag switcher dropdown
* Reading README content
* Navigating repository tabs (Code / Issues / Insights / Releases)
* Filtering issues with the Labels dropdown
* Reading Insights → Contributors
* Multi-page / multi-tab data aggregation

---

# **5. Amazon — Rail Filters, Price Range Entry, Sort, Image Gallery, and Variant Swatches**

**Difficulty: Very Hard**

## **Task**

Open Amazon and complete the following steps:

1. Search for `wireless mouse`.
2. In the **left filter rail**, apply the following (these are client-side filters, not account changes):
   * Customer rating: **4 Stars & Up**
   * Price: set a custom range such as **Under $30** (type min/max into the price range box and apply, or click the price band)
   * One **Brand** checkbox of your choice
3. Open the **Sort** dropdown and choose **Avg. Customer Review**.
4. **Hover** over one product's star rating to reveal the exact-rating tooltip, if shown; record what it reveals.
5. From the filtered results, select 3 products that match or are closest to the criteria. For each, extract:
   * Product name
   * Price
   * Rating
   * Review count
   * Whether Prime or fast delivery is visible
   * Product URL
6. Open the product detail page for the highest-rated product.
7. Click through the **image thumbnail gallery** (view 2–3 images). Then click a different **color/style swatch** and record whether the price, title, or main image updates.
8. Expand the **"Product description"** / **"See more"** section and the **"Product details"** / technical-specs accordion.
9. Extract:
   * Brand
   * Color or style options
   * First 5 product feature bullet points
   * Stock availability
10. Scroll to the reviews area; click a **star-breakdown bar** (e.g. "4 star") to filter reviews, or open the review **Sort** dropdown and choose "Most recent"; record one representative review snippet.
11. Return to the search results page and open the second selected product. Extract the same fields:
    * Brand
    * Color or style options
    * First 5 product feature bullet points
    * Stock availability
12. Compare the two product detail pages and state which product appears more suitable for office use.

## **Expected Capabilities Tested**

* E-commerce search
* Applying multiple left-rail filters (rating, custom price range, brand)
* Operating the Sort dropdown
* Hover-reveal tooltips
* Clicking through an image gallery
* Selecting product variant swatches and observing updates
* Expanding spec/description accordions
* Filtering or sorting reviews
* Returning to results and comparing products
* Recording blockers such as CAPTCHA, regional pages, login prompts, or cookie banners

---

# **6. Reddit — Result Sorting, Comment Sort Dropdown, Thread Expansion, and Subreddit Drill-Down**

**Difficulty: Hard**

## **Task**

Open Reddit and complete the following steps:

1. Search for `best mechanical keyboard for programming`.
2. On the search results, switch the result sort (e.g. "Relevance" → **Top**) and/or use the **Posts** tab, then find a relevant post with a relatively high number of comments.
3. Open the post and extract:
   * Post title
   * Subreddit name
   * Post time
   * Upvotes or score, if visible
   * Comment count
4. Read the post body or question description and summarize the user's original question.
5. Read the first 5 visible comments under the default comment sorting. For each comment, extract:
   * Comment author, if visible
   * Core recommendation or opinion
   * Whether the comment recommends a specific brand or model
6. Open the comment **Sort by** dropdown and switch the sorting to `Top` or `Best`.
7. Expand at least one collapsed thread (click **"more replies"** / **"view more comments"**) and read what it reveals.
8. Read the first 3 comments after sorting.
9. Click the **subreddit name** to open the subreddit; read its sidebar/about description, then return to the post.
10. Summarize the 3 most commonly recommended keyboard brands or models.
11. Return the post URL.

## **Expected Capabilities Tested**

* Search and result-sort switching
* Selecting a relevant discussion
* Opening a post and reading metadata
* Switching comment sort order via dropdown
* Expanding collapsed comment threads
* Drilling into a subreddit and returning
* Extracting informal user-generated content
* Summarizing recommendations

---

# **7. LinkedIn — Company Search, Modal Dismissal, and Tab Navigation Under Access Limits**

**Difficulty: Hard**

## **Task**

Open LinkedIn and complete the following steps:

1. Search for the company `OpenAI`.
2. Try to open OpenAI's company page.
3. If a login wall, access restriction, or redirect appears, record:
   * Type of restriction
   * What content remains visible
   * Whether further access requires login
4. If a login/sign-up **modal overlay** appears, attempt to dismiss it (click the **X**, "Skip", or outside the modal) **without logging in**, and record whether dismissal reveals additional content.
5. If the company page is accessible, extract:
   * Company name
   * Tagline or short description
   * Industry
   * Company size
   * Headquarters location
   * Official website link
6. Navigate to the `About` tab/section and extract the first 2 visible paragraphs of the company description.
7. Click the `Jobs` tab/link if visible; if jobs are accessible, extract the first 3 job listings:
   * Job title
   * Location
   * Posting context, if visible
8. Try each internal tab (About / Posts / Jobs / People) and record which tabs are reachable **without** logging in.
9. Return the final page URL and clearly state which information was inaccessible.

## **Expected Capabilities Tested**

* Searching on a platform with access restrictions
* Company page identification
* Dismissing login/sign-up modals without logging in
* Navigating between page tabs under restriction
* Reading company profile data when available
* Reading job listings when available
* Reporting inaccessible fields clearly

---

# **8. BBC News — Homepage, Article Expansion, Top-Nav Menu, and Sub-Section Tabs**

**Difficulty: Medium-Hard**

## **Task**

Open BBC News and complete the following steps:

1. Open the BBC News homepage and dismiss any cookie banner.
2. Identify the main headline story on the homepage. Extract:
   * Headline title
   * Short summary
   * News section or category, if visible
3. Click the main headline story. On the article page, extract:
   * Article title
   * Author or source
   * Publish time or last updated time
   * Key points from the first 5 paragraphs
4. On the article, expand any **"More on this story"** / related accordion or media caption, and record one related link title.
5. Use back-navigation to return to the homepage.
6. Open the **top navigation menu** (or the **More** menu) and navigate to the `World` section.
7. Within World, open one **sub-section tab** if present (e.g. a regional tab like "Asia" or "Europe").
8. Identify the first 3 visible news stories. For each, extract:
   * Title
   * Summary
   * Page URL
9. State whether the original homepage headline also appears in the World section.

## **Expected Capabilities Tested**

* Homepage parsing and cookie-banner handling
* Identifying top stories
* Opening article pages and reading metadata + body
* Expanding related-content modules within an article
* Back-navigation to the homepage
* Operating the top-nav menu and sub-section tabs
* Extracting story cards
* Detecting duplicate stories across sections

---

# **9. CNN — Nav Menu, Sub-Section Tabs, Content-Type Detection, and In-Article Expansion**

**Difficulty: Hard**

## **Task**

Open CNN and complete the following steps:

1. Open the CNN homepage and dismiss any cookie/region banner.
2. Open the **main navigation menu** and find the entry for `World` or international news.
3. Open the World section.
4. If World exposes **sub-section tabs** (e.g. a region), open one.
5. Read the first 5 visible news cards. For each card, determine:
   * Whether it appears to be an article, video, live update, or other content type
   * Title
   * Short summary, if visible
   * Page URL
6. Open the first regular article — not a video or live page if possible.
7. On the article page, extract:
   * Article title
   * Author
   * Publish time or last updated time
   * Key points from the first 5 paragraphs
8. Expand any in-article **"show more"** section or **photo gallery**, and record one detail revealed.
9. Look for a related-stories or recommended-stories module and extract 2 related story titles, if visible.
10. Return the World section URL.

## **Expected Capabilities Tested**

* Website navigation and banner handling
* Operating the nav menu and sub-section tabs
* Reading news cards and classifying content type
* Opening an article and reading metadata + body
* Expanding in-article content / galleries
* Reading related-story modules

---

# **10. The New York Times — Section Menu, Sub-Tabs, Paywall Modal Handling, and Article Comparison**

**Difficulty: Very Hard**

## **Task**

Open The New York Times and complete the following steps:

1. Open the homepage and dismiss any banner/overlay.
2. Open the **section navigation menu** (hamburger or top nav) and find a `Technology` or `Business` section link.
3. Open the selected section. If the section has **sub-tabs** (e.g. "Tech: Personal Tech"), open one.
4. Identify the first 3 visible articles in that section. For each, extract:
   * Title
   * Author
   * Publish time, if visible
   * Summary or subtitle
   * Page URL
5. Open the first article. Determine whether a subscription wall, login prompt, or paywall appears. If a **subscription modal** appears, attempt to dismiss it (click **X** / "Continue") **without subscribing**, and record the outcome.
6. If the article body is readable, extract key points from the first 5 paragraphs. If not readable, extract only the visible content and record where access becomes restricted.
7. Return to the section page and open the second article.
8. Repeat the paywall/modal check and visible-content extraction.
9. Compare the two articles:
   * Main topic of each article
   * Whether full text was accessible
   * Which article provided more visible information

## **Expected Capabilities Tested**

* Operating the section navigation menu and sub-tabs
* Article list extraction
* Opening article pages
* Detecting and dismissing subscription/paywall modals without subscribing
* Extracting visible text and noting where access is cut off
* Returning to section pages
* Comparing multiple articles

---

# **11. Stack Overflow — Search Sort Tabs, Answer Sort Tabs, Comment Expansion, and Tag Navigation**

**Difficulty: Hard**

## **Task**

Open Stack Overflow and complete the following steps:

1. Search for `Python list comprehension if else` using the site search box.
2. On the results, use the **sort tabs** (Relevance / Newest / Votes) — then open a highly relevant, high-vote question.
3. Extract:
   * Question title
   * Question vote count
   * Date asked
   * Tags
   * Summary of the question body
4. In the answers area, use the **answer sort tabs** ("Highest score (default)" / "Trending" / "Date") and confirm the answers are sorted by votes.
5. Locate the accepted answer. From it, extract:
   * Answer vote count
   * Core explanation
   * Key code snippet
6. Find one non-accepted but high-vote answer. Extract:
   * Answer vote count
   * Core explanation
   * Key code snippet
7. Expand a collapsed comment thread under an answer (click **"Show N more comments"**) and record one comment.
8. Click one of the question's **tags** to open the tag page; record the tag's "watchers" or "questions" count, then return to the question.
9. Compare the accepted answer with the high-vote non-accepted answer:
   * Which answer is more direct
   * Which answer explains the concept more fully
   * Whether there are syntax differences between the examples
10. Return the question page URL.

## **Expected Capabilities Tested**

* Technical search and result-sort tabs
* Operating the answer sort tabs
* Reading votes and metadata
* Recognizing accepted answers
* Expanding collapsed comment threads
* Tag-page navigation and return
* Extracting code blocks
* Comparing technical explanations on long Q&A pages

---

# **12. Airbnb — Date Picker, Guest Selector, Full Filter Modal, and Detail Modals**

**Difficulty: Very Hard**

## **Task**

Open Airbnb and complete the following steps:

1. Search for destination: `Tokyo, Japan`.
2. Open the **date picker** and set the stay dates to any future weekend for 2 nights.
3. Open the **guests** selector and set guests to 2 adults.
4. Submit the search.
5. On the results page, read the first 5 visible listing cards. For each, extract:
   * Listing title
   * Area or location
   * Nightly price or total price
   * Rating
   * Review count
   * Whether `Superhost`, `Guest favorite`, or a similar badge is visible
6. Open the full **Filters** modal.
7. Inside the modal, set a price cap (such as under USD 200 per night) using the **price slider or min/max inputs**, and toggle at least **2 more filters** (e.g. Bedrooms = 1+, an amenity like Wi-Fi, property type "Entire home"). Apply the filters.
8. Record how the visible result count changes after applying the filters.
9. Read the first 3 visible filtered listings.
10. Open the highest-rated listing detail page among the visible filtered results.
11. On the detail page, open the **photo gallery modal** (click a photo → "Show all photos"), then close it.
12. Click **"Show all amenities"** to open the amenities modal; extract the first 8 amenities, then close it.
13. Open the **reviews** modal/section if present; record the review count plus one category rating.
14. Extract:
    * Listing title
    * Host information
    * Check-in and checkout time, if visible
    * Bedroom, bed, and bathroom information
    * Cancellation policy summary
15. Return the listing detail page URL.

## **Expected Capabilities Tested**

* Destination search
* Date-picker interaction
* Guest-selector interaction
* Search submission
* Reading listing cards
* Opening the full filter modal and using a slider + multiple toggles
* Observing how filtering changes results
* Opening and closing photo gallery, amenities, and reviews modals
* Reading amenities and policies
* Handling dynamic UI, modals, and possible access restrictions

---

# **13. Booking.com — Date Picker, Occupancy Selector, Rail Filters, Sort, and Detail Drill-Down**

**Difficulty: Very Hard**

## **Task**

Open Booking.com and complete the following steps:

1. Search for destination: `Singapore`. Dismiss any region/currency popup that appears.
2. Open the **date picker** and set check-in and checkout dates to any future continuous 2-night stay.
3. Open the **occupancy** selector, set 2 adults, and apply.
4. Submit the search.
5. On the results page, apply the following filters (in the left rail) if available:
   * Review score above 8
   * Property type: Hotels
   * Free cancellation
6. Open the **Sort** dropdown and sort by review score / "Top reviewed" / recommended ranking, if available.
7. Read the first 5 visible hotel results. For each, extract:
   * Hotel name
   * Area
   * Total price
   * Review score
   * Review count
   * Whether free cancellation is visible
   * Whether breakfast is included or available
8. Hover over or click a hotel's **review score** to reveal the score-breakdown popover, if shown; record what it reveals.
9. Open the hotel detail page for the highest-rated visible hotel (this often opens a **new tab** — switch to it).
10. On the detail page, scroll to the facilities section and click **"Show all facilities"** if present; extract the first 8 facilities.
11. Open the **room/availability table** and record one room type name.
12. Open the **guest-reviews** section / subscore breakdown; extract scores for cleanliness, location, staff, comfort, or facilities.
13. Extract:
    * Full hotel name
    * Address
    * Check-in and checkout time
14. Return the hotel detail page URL.

## **Expected Capabilities Tested**

* Hotel search and popup handling
* Date-picker interaction
* Occupancy-selector interaction
* Applying multiple rail filters
* Operating the Sort dropdown
* Hover/click score-breakdown popovers
* Reading hotel result cards
* Switching to a new tab for the detail page
* Opening the facilities modal and room/availability table
* Reading review subscores and structured hotel information
* Handling popups, regional prompts, and dynamic content

---

# **14. Apple — Nav Dropdown, Compare Pickers, and Buy-Flow Option Toggles (No Checkout)**

**Difficulty: Hard**

## **Task**

Open the Apple website and complete the following steps:

1. Open the Apple homepage.
2. In the top navigation, **hover/click the `iPhone` menu item to reveal its dropdown nav**, then open the iPhone page.
3. Identify the currently promoted iPhone model. Extract:
   * Product name
   * Main marketing tagline
   * Starting price
   * 3 main selling points
4. Find and open the `Compare` page or product comparison section. Use the **model-picker dropdowns** to select two current mainstream iPhone models.
5. Extract the following comparison fields for each model:
   * Display size
   * Chip
   * Camera system
   * Battery life
   * Starting price
6. Return to one of the product detail pages.
7. Click the `Buy` or purchase entry point.
8. Without logging in or placing an order:
   * Click through the **color options** (select 2 different colors and observe the image change).
   * Click through the **storage capacity options** (observe the price change).
9. Open the **trade-in** question/expander; record whether trade-in is offered and what the device dropdown lists. Do **not** submit anything.
10. Open the **payment options** (Buy / monthly installments) toggle; record whether monthly payment, financing, or carrier options are offered.
11. Extract:
    * Available colors
    * Available storage capacities
    * Whether trade-in is offered
    * Whether monthly payment, financing, or carrier options are offered
12. Return the final page URL.

## **Expected Capabilities Tested**

* Homepage navigation and top-nav dropdown menus
* Product page reading
* Using compare-page model-picker dropdowns
* Product comparison
* Purchase-flow navigation without checkout
* Toggling buy-flow options (color, storage) and observing updates
* Operating trade-in and payment-option expanders
* Avoiding account-changing or purchase actions

---

# **Full Batch Test Prompt**

Use this prompt if you want to run all tasks sequentially:

```text
Use the openbrowser use tool to complete the following browser automation test suite.

General requirements:
1. Complete each website task independently.
2. Page operations and information extraction are equally important.
3. Each task requires complex, multi-step interactions (menus, dropdowns,
   accordions, modals, tabs, sliders, sorting, dynamic filters, hover-reveals,
   pagination). Actually perform these interactions rather than reading the
   initial page state only.
4. Follow the listed steps in order.
5. If a control (filter, sort, dropdown, modal, tab, slider, gallery) is
   present, open and operate it — the interaction itself is being tested.
6. If a step is blocked, record the blocker and continue with the remaining
   feasible steps. Dismiss dismissible overlays without logging in.
7. Do not log in, purchase anything, submit forms, post comments, send
   messages, make bookings, or perform actions that change account state.
8. Record all popups, login walls, paywalls, CAPTCHAs, regional restrictions,
   or failed page loads.
9. For every extracted data field, include the page or URL where it was found.
10. Record each non-trivial interaction (clicks, menus, dropdowns, modals,
    tabs, sliders) in the Page Operation Results.
11. Return a structured report for each task.
12. At the end, provide an overall summary of which websites were successfully
    completed, partially completed, or failed.

Use this output format for every task:

Task Name:
Target Website:
Final Status: Success / Partial Success / Failed

Execution Steps:
1. ...
2. ...
3. ...

Extracted Information:
- ...

Page Operation Results:
- Search completed:
- Filters applied:
- Sorting applied:
- Menus/dropdowns opened:
- Accordions/sections expanded:
- Modals/overlays opened (and closed):
- Tabs switched:
- Sliders/range controls set:
- Pagination performed:
- Navigation completed:
- Popup/login wall/paywall/CAPTCHA encountered:
- Manual intervention required:

Final URL:
Notes:

Tasks:
[Paste the 14 tasks here]
```

---

# **Suggested Scoring Rubric**

You can use the following rubric to evaluate the `openbrowser use` tool.

## **Operation Score: 0–5**

| **Score** | **Meaning**                                      |
| --------------- | ------------------------------------------------------ |
| 0               | Could not open or interact with the site               |
| 1               | Opened the site but failed most required operations    |
| 2               | Completed basic navigation but failed key interactions |
| 3               | Completed search and some navigation steps             |
| 4               | Completed most interactions, with minor missed steps   |
| 5               | Completed all required operations accurately           |

## **Extraction Score: 0–5**

| **Score** | **Meaning**                                             |
| --------------- | ------------------------------------------------------------- |
| 0               | No useful information extracted                               |
| 1               | Extracted only vague or incorrect information                 |
| 2               | Extracted a few fields but missed most required fields        |
| 3               | Extracted most basic fields                                   |
| 4               | Extracted nearly all fields with minor omissions              |
| 5               | Extracted all required fields accurately and with source URLs |

## **Robustness Score: 0–5**

| **Score** | **Meaning**                                                                   |
| --------------- | ----------------------------------------------------------------------------------- |
| 0               | Failed immediately when encountering a blocker                                      |
| 1               | Poor blocker handling and no recovery                                               |
| 2               | Identified blockers but did not continue                                            |
| 3               | Continued after some blockers                                                       |
| 4               | Handled blockers well and completed alternative steps                               |
| 5               | Clearly documented blockers, recovered gracefully, and completed all feasible steps |

## **Interaction Depth Score: 0–5**

| **Score** | **Meaning**                                                                       |
| --------------- | --------------------------------------------------------------------------------------- |
| 0               | No complex interactions attempted (read initial page state only)                        |
| 1               | Attempted one complex control but it failed                                             |
| 2               | Operated a few simple controls; skipped most menus/modals/sliders                       |
| 3               | Operated most required dropdowns/filters but skipped modals or multi-step chains        |
| 4               | Operated nearly all required controls (menus, modals, sliders, tabs) with minor gaps    |
| 5               | Executed every required complex interaction (menus, modals, sliders, tabs, drill-downs) |

Final score per task:

```text
Total Score = Operation Score + Extraction Score + Robustness Score
            + Interaction Depth Score + Final Result Quality Score
Maximum Score = 25
```

## **Final Result Quality Score: 0–5**

| **Score** | **Meaning**                                                   |
| --------------- | ------------------------------------------------------------------- |
| 0               | No structured result                                                |
| 1               | Very incomplete result                                              |
| 2               | Some structure but missing critical fields                          |
| 3               | Acceptable structured result                                        |
| 4               | Clear, mostly complete structured result                            |
| 5               | Complete, precise, well-structured result with URLs and limitations |

Overall suite score:

```text
Overall Score = Sum of all task scores / 350
```

Since there are 14 tasks and each task has a maximum of 25 points, the total maximum score is 350.
