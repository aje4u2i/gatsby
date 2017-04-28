// @flow
import { Runner } from "relay-compiler"
import {
  getFileFilter,
  getWriter,
  getSchema,
  getParser,
  getLocations,
} from "./compiler-helpers"

export default async function compile() {
  const { baseDir, schema } = getLocations()
  const runner = new Runner({
    parserConfigs: {
      default: {
        schema,
        baseDir,
        getFileFilter,
        getParser,
        getSchema,
      },
    },
    writerConfigs: {
      default: {
        getWriter,
        parser: "default",
      },
    },
    onlyValidate: false,
    skipPersist: true,
  })

  await runner.compileAll()
}
