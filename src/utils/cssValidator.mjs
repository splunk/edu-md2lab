import stylelint from "stylelint";
import logger from "../utils/logger.js";

export async function validateCss(css, filePath = "custom.css") {
  try {
    const result = await stylelint.lint({
      code: css,
      codeFilename: filePath,
    });

    if (result.errored) {
      logger.warn(`Issues found in ${filePath}:`);
      result.results[0].warnings.forEach((warning) => {
        logger.warn(
          `  [${warning.severity}] ${warning.text} (line ${warning.line})`
        );
      });
    } else {
      logger.info(`🔍 Validating ${filePath}`);
    }
  } catch (err) {
    logger.error(`Failed to lint ${filePath}: ${err.message}`);
  }
}
