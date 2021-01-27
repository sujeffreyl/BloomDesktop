import theme from "../bloomMaterialUITheme";
import * as React from "react";
import { ThemeProvider } from "@material-ui/styles";
import { storiesOf } from "@storybook/react";
import { addDecorator } from "@storybook/react";
import { StorybookContext } from "../.storybook/StoryBookContext";
import { ErrorReportDialog, ProblemKind } from "./ErrorReportDialog";

// TODO: Stories are broken. Is that because of recently upgrading dependencies?

addDecorator(storyFn => (
    <ThemeProvider theme={theme}>
        <StorybookContext.Provider value={true}>
            {storyFn()}
        </StorybookContext.Provider>
    </ThemeProvider>
));

// Note: Alternatively, you can test this pretty easily by starting Bloom,
// then using your browser to navigate to: http://localhost:8089/bloom/[encodedPathToBloomRepo]/output/browser/errorReport/loader.html?user&reportable=1&msg=[encodedMessage]
// e.g. http://localhost:8089/bloom/C%3A/src/BloomDesktop5.1/output/browser/errorReport/loader.html?user&reportable=0&msg=Hello+world

storiesOf("Problem Report", module)
    //     .add("NonFatalError", () => <ErrorReportDialog kind={ProblemKind.NonFatal} />)
    //     .add("FatalError", () => <ErrorReportDialog kind={ProblemKind.Fatal} />)
    .add("UserProblem (Reportable)", () => (
        <ErrorReportDialog
            kind={ProblemKind.User}
            reportable={true}
            message="Fake error message"
        />
    ))
    .add("UserProblem (Not Reportable)", () => (
        <ErrorReportDialog
            kind={ProblemKind.User}
            reportable={false}
            message="Fake error message"
        />
    ));
