/** *
 * Jobs of this module
 * - Maintain the list of components in the Redux store. So monitor new pages
 *   and add/remove components.
 * - Watch components for query changes and extract these and update the store.
 * - Ensure all page queries are run as part of bootstrap and report back when
 *   this is done
 * - Whenever a query changes, re-run all pages that rely on this query.
 ***/

const _ = require(`lodash`)
const chokidar = require(`chokidar`)

const { store } = require(`../redux/`)
const { boundActionCreators } = require(`../redux/actions`)
const queryCompiler = require(`./query-compiler`).default
const queryRunner = require(`./query-runner`)

const pageComponents = {}

const watcher = chokidar.watch().on(`change`, path => {
  console.log(`page query change`)
  queryCompiler()
    .then(queries => {
      const query = queries.get(path)

      // Check if the query has changed
      if (query !== store.getState().pageComponents[path].query) {
        boundActionCreators.setPageComponentQuery({
          query: query && query.text,
          componentPath: path,
        })
        runQueriesForComponent(path)
      }
    })
    .catch(err => console.log(err))
})

const debounceNewPages = _.debounce(() => {
  store.dispatch({
    type: `BOOTSTRAP_STAGE`,
    payload: {
      stage: `COMPONENT_QUERIES_EXTRACTION_FINISHED`,
    },
  })
}, 100)

// Watch for page updates.
store.subscribe(() => {
  const lastAction = store.getState().lastAction
  if (lastAction.type === `UPSERT_PAGE`) {
    if (!pageComponents[lastAction.payload.component]) {
      // We haven't seen this component before so we:
      // - Add it to Redux
      // - Extract its query and save it
      // - Setup a watcher to detect query changes
      boundActionCreators.addPageComponent(lastAction.payload.component)
      console.log(`compiled!`)
      queryCompiler()
        .then(queries => {
          const query = queries.get(lastAction.payload.component)

          boundActionCreators.setPageComponentQuery({
            query: query && query.text,
            componentPath: lastAction.payload.component,
          })
          debounceNewPages()
        })
        .catch(err => console.log(err))

      watcher.add(lastAction.payload.component)
    }

    // Mark we've seen this page component.
    pageComponents[lastAction.payload.component] = lastAction.payload.component
  }
})

const runQueriesForComponent = componentPath => {
  const pages = getPagesForComponent(componentPath)
  console.log(`running queries for`, pages.map(p => p.path))
  // Remove page data dependencies before re-running queries because
  // the changing of the query could have changed the data dependencies.
  // Re-running the queries will add back data dependencies.
  boundActionCreators.removePagesDataDependencies(pages.map(p => p.path))
  const component = store.getState().pageComponents[componentPath]
  return Promise.all(pages.map(p => queryRunner(p, component)))
}

const getPagesForComponent = componentPath => {
  return store.getState().pages.filter(p => p.component === componentPath)
}
