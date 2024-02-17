declare function _exports(code: string, options?: FromMemOptions | undefined): Promise<unknown>;
export = _exports;
/**
 * Options for how to process code.
 */
export type FromMemOptions = {
    /**
     * What format does the code have?  Throws an error if the format is not
     * "commonjs", "es", "umd", or "bare".
     */
    format?: "amd" | "bare" | "commonjs" | "es" | "globals" | "umd" | undefined;
    /**
     * What is the fully-qualified synthetic
     * filename for the code?  Most important is the directory, which is used to
     * find modules that the code import's or require's.
     */
    filename: string;
    /**
     * Variables to make availble in the global
     * scope while code is being evaluated.
     */
    context?: object | undefined;
    /**
     * Include the typical global
     * properties that node gives to all modules.  (e.g. Buffer, process).
     */
    includeGlobals?: boolean | undefined;
    /**
     * For type "globals", what name is
     * exported from the module?
     */
    globalExport?: string | undefined;
};
