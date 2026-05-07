# Generating a table of contents (TOC)

* Only generates a TOC in the first Markdown page (default `00-introduction.md`, but may be configured as something else using `manifest.json`)

* Automatically generates the links for each page if the second-level header `## Table of contents` (or `## Table of Contents`) is found under the top-level header in the first page and it is not followed by a list. For example, if the directory structure contains the following files and corresponding top-level headers: 
    - 00-introduction.md -> `# Learning stuff`
    - 01-learning-this.md -> `# Getting more specific`
    - 02-learning-that.md -> `# Even more specific`
    - 03-learning-the-other.md -> `In the weeds now`

    The tool will generate the following TOC on the first page:
    ```md
    # Learning Stuff

    ## Table of contents

    * [Introduction](#learning-stuff)
    * [Getting more specific](#getting-more-specific)
    * [Even more specific](#even-more-specific)
    * [In the weeds now](#in-the-weeds-now)
    ```

* Allows the developer to "hardcode" the TOC in Markdown if they want to override the auto-generated list. They use the header `## Table of contents` followed by a list of corresponding links. This also allows them to link to subheaders (`##`, `###`, etc.) of individual pages. For example: 
    ```md
    # Learning Stuff

    ## Table of contents

    * [Manual override](#learning-stuff)
    * [Getting more specific](#getting-more-specific)
    * [Even more specific](#even-more-specific)
        - [So specific](#so-specific)
    * [In the weeds now](#in-the-weeds-now)
    ```