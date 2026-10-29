# She Reads Melanin — Library

A personal library site for GitHub Pages. It has one long shelf of books standing face-out, switchable between your **Read shelf** and the **whole library**. Clicking a book opens its card with your verdict, review, and the TikTok, Instagram or YouTube posts you made about it, playable on the page.

## Put it online (once)

1. On GitHub, create a new **public** repository named `shereadsmelanin.github.io`.
2. Click **Add file → Upload files**. Unzip the download, then drag in everything, **including the `covers` folder**:
   `index.html`, `styles.css`, `app.js`, `books.js`, `README.md`, `covers/`.
   The files go at the top level of the repo, not inside another folder.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, select **main** and **/(root)**, then **Save**.
4. After a minute or two the site is live at `https://shereadsmelanin.github.io`. Put that link in your bio.

## Everyday updates: edit `books.js` only

Open `books.js` on GitHub, click the pencil icon, make your change, then **Commit changes**. The site updates within a minute or two.

- **Your profile links:** fill in the `PROFILE` block at the top.
- **Move a book onto the Read shelf:** find its line and add `read: true`.
- **Link your posts:** add `tiktok:`, `instagram:` or `youtube:` with the full link from the app's **Copy link** button.
- **Currently reading:** add `reading: true`.
- **New book:** copy any line, paste it, and change the title, author and genre.

There's a worked example at the top of `books.js`.

> If the page goes blank after an edit, it's almost always a missing `"` or `,`. Compare your line with the example.

## Link straight to one book

Every book has its own link: the site address plus `#` and the title in lowercase with dashes.

`https://shereadsmelanin.github.io/#honey-spice` opens the *Honey & Spice* card directly. You can put that in a caption or a comment: "full review, link in bio."

## Notes

- Covers come from Open Library automatically. Books with a `cover: "covers/..."` line use your own photo from the `covers` folder instead.
- To add another photo: upload it into `covers` on GitHub (type `covers/` before the file name), then add `cover: "covers/your-file.jpg",` to that book in `books.js`.
- Short share links (like `vm.tiktok.com/...`) still work as buttons, but they won't play on the page. Use the full link if you want the video to play.
- Every book currently has a genre already set. Change any you disagree with.
