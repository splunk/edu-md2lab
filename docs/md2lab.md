# md2lab

`md2lab` uses two files:

- `metadata.json` or `metadata.yaml`
- `manifest.json` or `manifest.yaml`

Your metadata file describes the content of your course. The manifest file allows you to customize the generation of course materials.

The metadata file is required. The manifest file is optional. If you don't use it, `md2lab` will use its default settings.

You can use either JSON or YAML. The default file format is YAML. You can convert one format to the other using the `-m` option:

```sh
md2lab -m [JSON|YAML]
```

## Using images

You can scale and align images using the following synax:

```md
![alt](image.png 'scale=50%')
![alt](image.png 'align=center')
![alt](image.png 'scale=75% align=right')
```

Note that text does not flow around the image.

## Generating a table of contents (TOC)

- Only generates a TOC in the first Markdown page (default `00-introduction.md`, but may be configured as something else using `manifest.json`)

- Automatically generates the links for each page if the second-level header `## Table of contents` (or `## Table of Contents`) is found under the top-level header in the first page and it is not followed by a list. For example, if the directory structure contains the following files and corresponding top-level headers:
    - 00-introduction.md -> `# Learning stuff`
    - 01-learning-this.md -> `# Getting more specific`
    - 02-learning-that.md -> `# Even more specific`
    - 03-learning-the-other.md -> `In the weeds now`

    The tool will generate the following TOC on the first page:

    ```md
    # Learning Stuff

    ## Table of contents

    - [Introduction](#learning-stuff)
    - [Getting more specific](#getting-more-specific)
    - [Even more specific](#even-more-specific)
    - [In the weeds now](#in-the-weeds-now)
    ```

- Allows the developer to "hardcode" the TOC in Markdown if they want to override the auto-generated list. They use the header `## Table of contents` followed by a list of corresponding links. This also allows them to link to subheaders (`##`, `###`, etc.) of individual pages. For example:

    ```md
    # Learning Stuff

    ## Table of contents

    - [Manual override](#learning-stuff)
    - [Getting more specific](#getting-more-specific)
    - [Even more specific](#even-more-specific)
        - [So specific](#so-specific)
    - [In the weeds now](#in-the-weeds-now)
    ```

## Using a manifest file

### Using a custom input

`md2lab` expects to find a `lab-guides` directory containing your Markdown files in the root of your course diretory. You can specify a different directory in your `manifest.json/yaml` file:

```json
{
    "input": {
        "labGuides": "./custom-dir"
    }
}
```

### Using a custom output

`md2lab` will output your lab guide in a `./dist` directory by default. It will also generate a name for the output PDF using the `slug` in your metadata. You can specify a different output directory and filename in your `manifest.json/yaml` file:

```json
{
    "output": {
        "destination": "./custom",
        "pdfs": {
            "labGuide": "custom-filename.pdf"
        }
    }
}
```

### Generating multiple outputs

`md2lab` will generate multiple outputs if you specify an array of paths to the `input.labGuides`:

```json
{
    "input": {
        "labGuides": ["./dir01/", "./dir02/manifest.json"]
    }
}
```

Note that you can customize the output of each subdirectory with its own manifest file.

### Using syntax highlighting

`md2lab` uses `highlight.js` to apply syntax highlighting to fenced code blocks. Specify the theme you want to use:

```json
{
    "output": {
        "render": {
            "code": {
                "theme": "atom-one-dark"
            }
        }
    }
}
```

You can browse and demo available themes here https://highlightjs.org/demo

### Using plugins

`md2lab` is built using a plugin architecture which allows the tool to be extended for other uses.

#### Generating a web page

If you want a web page rather than a PDF, enable the `webpage` plugin:

```json
{
    "plugins": [
        {
            "name": "webpage"
        }
    ]
}
```

This will output an `index.html` file in your `./dist` folder. Copy-to-clipboard is enabled on fenced code blocks as well as a sidebar menu.
