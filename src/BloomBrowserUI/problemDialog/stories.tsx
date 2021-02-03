import theme from "../bloomMaterialUITheme";
import * as React from "react";
import { ThemeProvider } from "@material-ui/styles";
import { storiesOf } from "@storybook/react";
import { addDecorator } from "@storybook/react";
import { StorybookContext } from "../.storybook/StoryBookContext";
import { ReportDialog, ProblemKind } from "./ProblemDialog";
import { NotifyDialog } from "./NotifyDialog";

addDecorator(storyFn => (
    <ThemeProvider theme={theme}>
        <StorybookContext.Provider value={true}>
            {storyFn()}
        </StorybookContext.Provider>
    </ThemeProvider>
));

storiesOf("Problem Report", module)
    .add("NonFatalError", () => <ReportDialog kind={ProblemKind.NonFatal} />)
    .add("FatalError", () => <ReportDialog kind={ProblemKind.Fatal} />)
    .add("UserProblem", () => <ReportDialog kind={ProblemKind.User} />);
storiesOf("Notify User Dialog", module)
    .add("NotifyUser, Non-Reportable", () => (
        <NotifyDialog reportable={false} messageParam="Fake error" />
    ))
    .add("NotifyUser, Non-Reportable", () => (
        <NotifyDialog reportable={true} messageParam="Fake error" />
    ));
