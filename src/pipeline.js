import logger from './utils/logger.js';

/**
 * Pipeline executor - runs stages in sequence
 */
export class Pipeline {
    constructor(stages = []) {
        this.stages = stages;
    }

    async run(context) {
        logger.info('🚀 Starting pipeline...');

        for (const stage of this.stages) {
            const stageName = stage.name || 'Unknown Stage';

            try {
                logger.debug(`Running stage: ${stageName}`);
                await stage.execute(context);

                if (context.hasErrors()) {
                    logger.error(`Stage ${stageName} generated errors:`);
                    context.getErrorMessages().forEach((msg) => logger.error(`  ${msg}`));
                    throw new Error(`Pipeline stopped due to errors in ${stageName}`);
                }

                if (context.warnings.length > 0) {
                    context.warnings.forEach((w) => {
                        if (w.stage === stageName) {
                            logger.warn(`  ${w.message}`);
                        }
                    });
                }
            } catch (error) {
                logger.error(`Pipeline failed at stage: ${stageName}`);
                throw error;
            }
        }

        logger.info('✅ Pipeline completed successfully');
        return context;
    }

    addStage(stage) {
        this.stages.push(stage);
    }
}

export class Stage {
    constructor(name) {
        this.name = name;
    }

    async execute(_context) {
        throw new Error(`Stage ${this.name} must implement execute() method`);
    }
}
