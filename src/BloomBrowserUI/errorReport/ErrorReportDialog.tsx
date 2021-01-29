import * as React from "react";
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
    TextField,
    Typography
} from "@material-ui/core";
import { BloomApi } from "../utils/bloomApi";
import { makeStyles, ThemeProvider, withStyles } from "@material-ui/styles";
import "./ErrorReportDialog.less";
import BloomButton from "../react_components/bloomButton";
import { makeTheme, sevParams } from "./theme";
import ReactDOM = require("react-dom");
import { useL10n } from "../react_components/l10nHooks";
import { encode } from "html-entities";

export enum Severity {
    NonFatal = "NonFatal",
    Fatal = "Fatal"
}

const kEdgePadding = "24px";
export const ErrorReportDialog: React.FunctionComponent<{
    kind: Severity;
    reportable: boolean;
    messageParam: string | null;
}> = props => {
    const theme = makeTheme(props.kind);
    const englishTitle = sevParams[props.kind.toString()].title;
    const titleKey = sevParams[props.kind.toString()].l10nKey;
    const localizedDlgTitle = useL10n(englishTitle, titleKey);

    const [message] = BloomApi.useApiStringIf(
        "errorReport/message",
        props.messageParam || "",
        () => {
            return props.messageParam === null;
        }
    );

    const useContentStyle = makeStyles({
        root: {
            padding: `27px ${kEdgePadding}`
        }
    });

    // Assuming we've tried to submit a report (no matter the result),
    // this will give us either a Close or Quit button.
    const getEndingButton = (): JSX.Element | null => {
        const keyword = props.kind === Severity.Fatal ? "Quit" : "Close";
        const l10nKey = `ReportProblemDialog.${keyword}`;
        return (
            <BloomButton
                enabled={true}
                l10nKey={l10nKey}
                hasText={true}
                onClick={() => {
                    BloomApi.post("dialog/close");
                }}
            >
                {keyword}
            </BloomButton>
        );
    };

    // Shows the action buttons, as appropriate.
    const getDialogActionButtons = (): JSX.Element => {
        const useRightStyle = makeStyles({
            // So that the right edge of the "Close" button will line up with the right edge of the ContentText
            root: {
                paddingRight: "0px"
            }
        });

        const useLeftStyle = makeStyles({
            // So that the left edge of the "Report" button will line up with the left edge of the ContentText
            root: {
                paddingLeft: "0px"
            },
            // So that the left edge of the "Report" text will line up with the left edge of the button
            text: {
                paddingLeft: "0px"
            }
        });
        return (
            <>
                <div className="buttonHolder">
                    {/* Note: buttonHolder is a flexbox with row-reverse, so the 1st one is the right-most.
                        Using row-reverse allows us to skip putting an empty leftActions, which is theoretically one less thing to render
                    */}
                    <DialogActions className={useRightStyle().root}>
                        <BloomButton
                            enabled={true}
                            l10nKey="ErrorReportDialog.Retry"
                            hasText={true}
                            variant="text"
                            color="secondary"
                            onClick={() => {
                                BloomApi.postData("dialog/close", {
                                    source: "alternate"
                                });
                            }}
                        >
                            Secondary Action
                        </BloomButton>
                        {getEndingButton()}
                    </DialogActions>
                    {props.reportable && (
                        <DialogActions className={useLeftStyle().root}>
                            <BloomButton
                                className={`errorReportButton ${
                                    useLeftStyle().text
                                }`}
                                enabled={true}
                                l10nKey="ErrorReportDialog.Report"
                                hasText={true}
                                variant="text"
                                color="secondary"
                                onClick={() => {
                                    BloomApi.postData("dialog/close", {
                                        source: "report"
                                    });
                                }}
                            >
                                Report
                            </BloomButton>
                        </DialogActions>
                    )}
                </div>
            </>
        );
    };

    return (
        <ThemeProvider theme={theme}>
            <Dialog
                className="problem-dialog"
                open={true}
                // the behavior of fullWidth/maxWidth is very strange
                //fullWidth={true}
                maxWidth={"md"}
                fullScreen={true}
                onClose={() => BloomApi.post("dialog/close")}
            >
                {/* The whole disableTypography and Typography thing gets around Material-ui putting the
                    Close icon inside of the title's Typography element, where we don't have control over its CSS. */}
                <DialogTitle
                    className="dialog-title allowSelect"
                    disableTypography={true}
                >
                    <Typography variant="h6">{localizedDlgTitle}</Typography>
                    {/* We moved the X up to the winforms dialog so that it is draggable
                         <Close
                        className="close-in-title"
                        onClick={() => BloomApi.post("dialog/close")}
                    /> */}
                </DialogTitle>
                <DialogContent className={useContentStyle().root}>
                    {/* InnerHTML is used so that we can insert <br> entities into the message. */}
                    <DialogContentText
                        className="allowSelect"
                        dangerouslySetInnerHTML={{
                            __html: formatForHtml(message)
                        }}
                    ></DialogContentText>
                </DialogContent>
                {getDialogActionButtons()}
            </Dialog>
        </ThemeProvider>
    );
};

// Takes in an unsafe piece of text, and readies it to be displayed in HTML.
// The result will be:
// 1) HTML-encoded (so, theoretically safe to pass into InnerHTML)
// 2) newlines and carriage returns are converted into <br> elements.
function formatForHtml(unsafeText: string): string {
    let safeText = encode(unsafeText);

    // Replace literal newlines (which HTML ignores) with <br> elements.
    const htmlNewline = "<br />";
    safeText = safeText
        .replace(/\r\n/g, htmlNewline)
        .replace(/\r/g, htmlNewline)
        .replace(/\n/g, htmlNewline);

    return safeText;
}

// allow plain 'ol javascript in the html to connect up react
(window as any).connectErrorReportDialog = (element: Element | null) => {
    // TODO: Document query string parameters

    const queryStringWithoutQuestionMark = window.location.search.substring(1);
    const params = new URLSearchParams(queryStringWithoutQuestionMark);

    const severityStr = params.get("sev");
    let severity: Severity | undefined = Severity[severityStr || ""];
    if (severity === undefined) {
        console.assert(
            severity,
            `Severity (${severityStr}) could not be parsed.`
        );
        severity = Severity.NonFatal;
    }

    ReactDOM.render(
        <ErrorReportDialog
            kind={severity}
            reportable={params.get("reportable") === "1"}
            messageParam={params.get("msg")}
        />,
        element
    );
};
