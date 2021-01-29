import { createMuiTheme, Theme } from "@material-ui/core/styles";
import { Severity } from "./ErrorReportDialog";

const kBloomBlue = "#1d94a4";
const kNonFatalColor = "#F3AA18";
export const sevParams = {
    // TODO: Cleanup
    // User: {
    //     dialogHeaderColor: kBloomBlue,
    //     primaryColor: kBloomBlue,
    //     title: "Report a Problem",
    //     l10nKey: "ReportProblemDialog.UserTitle"
    // },
    Fatal: {
        dialogHeaderColor: "#f44336", // a bright red color
        primaryColor: "#2F58EA", // a bright blue color
        title: "Bloom encountered an error and needs to quit",
        l10nKey: "ReportProblemDialog.FatalTitle"
    },
    NonFatal: {
        dialogHeaderColor: kNonFatalColor,
        primaryColor: kNonFatalColor,
        title: "Bloom had a problem",
        l10nKey: "ReportProblemDialog.NonFatalTitle"
    }
};

export function makeTheme(severity: Severity): Theme {
    // (21 Nov. '19) "<any>"" is required because we define fontFamily as type string[], but as of now
    // the Material UI typescript defn. doesn't allow that. It works, though.
    return createMuiTheme(<any>{
        palette: {
            primary: { main: sevParams[severity.toString()].primaryColor },
            secondary: { main: "#FFFFFF" },
            error: { main: sevParams["NonFatal"].primaryColor }
        },
        typography: {
            fontSize: 12,
            fontFamily: ["NotoSans", "Roboto", "sans-serif"]
        },
        props: {
            MuiLink: {
                variant: "body1" // without this, they come out in times new roman :-)
            }
        },
        overrides: {
            MuiOutlinedInput: {
                input: {
                    padding: "7px"
                }
            },
            MuiDialogTitle: {
                root: {
                    color: "#FFFFFF",
                    backgroundColor:
                        sevParams[severity.toString()].dialogHeaderColor,
                    "& h6": { fontWeight: "bold" }
                }
            },
            MuiDialogContentText: {
                root: {
                    color: "#000000"
                }
            },
            MuiDialogActions: {
                root: {
                    primary: "#FFFFFF",
                    backgroundColor: "#FFFFFF",
                    paddingRight: 20,
                    paddingBottom: 20
                }
            },
            MuiButton: {
                // Set the text colors of the DialogAction buttons
                containedPrimary: {
                    color: "#FFFFFF"
                },
                textSecondary: {
                    color: sevParams[severity.toString()].dialogHeaderColor
                }
            }
        }
    });
}
