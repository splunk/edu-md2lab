# Using a custom input

`md2lab` expects to find a `lab-guides` directory containging your Markdown files in the root of your course diretory. You can specify a different directory in your `manifest.json/yaml` file:

```json
{
    "input": {
        "labGuides": "./custom-dir"
    }
}
```
