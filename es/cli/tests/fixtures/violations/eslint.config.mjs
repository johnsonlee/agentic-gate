export default [
  {
    plugins: {
      fixture: {
        rules: {
          "project-rule": {
            meta: {
              type: "problem",
              schema: [],
              messages: { blocked: "Project-configured plugin executed." }
            },
            create(context) {
              return {
                Program(node) {
                  context.report({ node, messageId: "blocked" });
                }
              };
            }
          }
        }
      }
    },
    rules: {
      "fixture/project-rule": "error"
    }
  }
];
