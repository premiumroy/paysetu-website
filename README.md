# PaySetu website

Static site for the PaySetu Android app. No build step, no npm, no framework — the files
are served exactly as they are. Published with GitHub Pages at
<https://premiumroy.github.io/paysetu-website/>.

| File | What it is |
|---|---|
| `index.html` | landing page: hero, features, how a payment works, privacy, FAQ |
| `privacy-policy.html` | the page Google Play requires, with a sticky table of contents |
| `terms.html` | terms of use, same layout |
| `style.css` | the whole design system — tokens, glass surfaces, layout, responsive rules |
| `script.js` | theme toggle, scroll reveals, phone mockup, sticky timeline, FAQ, counters |
| `favicon.svg` | the app mark, used as the site icon |
| `og.jpg` | 1200x630 social preview image |

## Editing

Open `index.html` in a browser — there is nothing to compile. Colours, radii, shadows and
spacing all live as CSS custom properties at the top of `style.css`, so a palette change is
one block.

## Deploying

GitHub Pages serves the repository root on `main`, so a push is a deploy. To publish the
same files on Netlify instead, import this repository there: leave the build command empty
and set the publish directory to the repository root.
