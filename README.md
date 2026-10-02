# Football Coaching Planner

A small website for the coaching team: browse the drill library, build 6-week training plans, and share or print them.

It is plain HTML, CSS and JavaScript. There is nothing to install and nothing to build – the files in this folder *are* the website.

## What is in this folder

| File or folder | What it is |
| --- | --- |
| `index.html` | The page itself (the layout of the three screens: Drills, Recommend and 6-week plan). |
| `css/style.css` | Colours, fonts, spacing and the print layout. |
| `js/app.js` | How the site behaves: filters, the plan builder, sharing and printing. |
| `js/recommend.js` | The "Recommend a plan" feature: the phrases it understands and how it builds six weeks. |
| `data/drills.js` | Every drill from the Word repository, as data. |
| `img-1/`, `img-2/` | One infographic per drill, named by drill code (for example `FB-001.jpg`). |

To try it on your own computer, double-click `index.html`.

## Put it online with GitHub Pages (free)

You only do this once. It takes about ten minutes.

1. Go to <https://github.com> and create a free account.
2. Click **+** (top right) → **New repository**.
   - Repository name: for example `football-planner`
   - Choose **Public** (on a free account, GitHub Pages only works for public repositories)
   - Tick **Add a README file**
   - Click **Create repository**
3. On the repository page click **Add file** → **Upload files**.
4. GitHub accepts up to 100 files per upload, so do it in two goes:
   - **First upload:** open this folder on your computer, select everything **except** `img-2`
     (`index.html`, `README.md`, `css`, `js`, `data`, `img-1`) and drag it onto the upload box.
     Wait for the files to finish, then click **Commit changes**.
   - **Second upload:** click **Add file** → **Upload files** again, drag the `img-2` folder on,
     and click **Commit changes**.
5. Click **Settings** (top of the repository) → **Pages** (left-hand menu).
6. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
   Choose branch **main** and folder **/(root)**, then click **Save**.
7. Wait a few minutes (it can take up to ten), then refresh the Pages screen. Your address appears at the top:

   `https://YOUR-USERNAME.github.io/football-planner/`

Send that address to the other coaches.

**Good to know:** because the repository is public, anyone who has the address can see the drills and pictures. Don't add players' names or photos.

## Using the site

- **Drills** – search, or filter by category, type of practice, intensity, length and number of players. Click a drill for the full coach instructions.
- **Add to plan** – puts a drill into one of the six weeks.
- **Recommend** – describe what the team finds difficult in your own words (for example "they all chase the ball and we lose it from goal kicks"). The site picks out up to three priorities, shows which words it matched, and drafts six weeks that build from "learn it" to "under pressure" to "in the game". **Show another version** gives a different draft; **Save as a new plan** puts it in the plan builder to edit.
- **6-week plan** – give each week a focus, add drills, reorder them, and add notes. **Suggest a session** builds a session for the week's focus: arrival activity, warm-up, practices, then a game.
- **Share this plan** – makes a link that contains the whole plan. Whoever opens it sees the plan and can save their own copy.
- **Print plan** – prints the six sessions, with a page per drill if you tick the box. Each week also has its own **Print** button.

Plans are saved in the browser you are using, on that device only. To move a plan to another phone or computer, use **Share this plan** and open the link there.

## Changing or adding drills

The drills live in `data/drills.js`, which was generated from *Football Drill Repository.docx*. When the Word document changes, the easiest route is to regenerate `data/drills.js` and the pictures from it, then upload the changed files to GitHub the same way as above (files with the same name are replaced).

To fix a small thing by hand, open `data/drills.js` on GitHub, click the pencil icon, edit the text between the quotation marks and click **Commit changes**.

To add a drill by hand, copy an existing block in `data/drills.js` (from `{` to `}`), change the `id`, text and `img` values, and upload its picture into `img-2/` with the same file name.

## How "Recommend" works, and teaching it new phrases

It is not an AI service and nothing you type leaves your browser. It works in three steps:

1. It looks for phrases in your description and links them to coaching themes (the list is at the top of `js/recommend.js`).
2. It finds drills for each theme using the drill details from the Word document: category, primary outcome, secondary outcomes, game moment and player decision.
3. It orders them using each drill's opposition level and practice type, and the "recommended preceding / following drill" links, so the weeks get harder.

If it misses something you say often, open `js/recommend.js`, find the right theme and add your phrase to its `say` list, for example `/hog\w* the ball/`.

## Changing the look

The colours are listed at the top of `css/style.css`. For example, change `--green-900` to change the header colour.
