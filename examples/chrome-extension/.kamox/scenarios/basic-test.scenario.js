export default {
    name: 'basic-test',
    description: 'Basic scenario to verify the scenario feature works.',
    version: '1.0.0',
    requiresPersistentContext: true,
    requiresServiceWorkerInit: true,

    async setup(context, logger) {
        logger.log('info', 'Scenario setup started', 'scenario');

        // Open a new page to verify context is working
        const page = await context.newPage();
        await page.goto('https://example.com');

        logger.log('info', 'Successfully opened example.com', 'scenario');

        // Wait a bit to simulate work
        await new Promise(resolve => setTimeout(resolve, 1000));

        logger.log('info', 'Scenario setup completed', 'scenario');
    }
};




