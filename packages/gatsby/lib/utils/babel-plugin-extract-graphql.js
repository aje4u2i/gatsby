/*  eslint-disable new-cap */
const graphql = require("graphql")

function getGraphQLTag(path) {
  const tag = path.get("tag")
  if (!tag.isIdentifier({ name: "graphql" })) return

  const quasis = path.node.quasi.quasis

  if (quasis.length !== 1) {
    throw new Error(
      "BabelPluginGraphQL: Substitutions are not allowed in graphql fragments. " +
        "Included fragments should be referenced as `...MyModule_foo`."
    )
  }

  const text = quasis[0].value.raw
  const ast = graphql.parse(text)

  if (ast.definitions.length === 0) {
    throw new Error("BabelPluginGraphQL: Unexpected empty graphql tag.")
  }

  return ast
}

function BabelPluginGraphQL({ types: t }) {
  return {
    visitor: {
      TaggedTemplateExpression(path, state) {
        const ast = getGraphQLTag(path)

        if (!ast) return

        const mainDefinition = ast.definitions[0]

        // We only need to maintain the queries for extraction later
        if (
          mainDefinition.kind === "OperationDefinition" &&
          mainDefinition.operation !== "query"
        )
          throw new Error(
            "BabelPluginGraphQL: Only `query` operations are supported."
          )

        return path.replaceWith(
          t.StringLiteral("** extracted graphql fragment **")
        )
      },
    },
  }
}

BabelPluginGraphQL.getGraphQLTag = getGraphQLTag
module.exports = BabelPluginGraphQL
