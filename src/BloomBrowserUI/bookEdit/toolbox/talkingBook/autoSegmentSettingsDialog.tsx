import * as React from "react";
import * as ReactModal from "react-modal";
import CloseOnEscape from "react-close-on-escape";
import { Div } from "../../../react_components/l10n";

interface IState {
    isOpen: boolean;
}

export default class AutoSegmentSettingsDialog extends React.Component<
    {},
    IState
> {
    private static singleton: AutoSegmentSettingsDialog;
    public readonly state: IState = { isOpen: false };

    constructor(props) {
        super(props);
        AutoSegmentSettingsDialog.singleton = this;
        this.state = {
            isOpen: false
        };
    }

    private handleCloseModal(doSave: boolean) {
        alert("Closing modal");
        if (doSave) {
            // BloomApi.postData("book/metadata", this.metadata);
            // BloomApi.post("publish/epub/updatePreview");
        }
        this.setState({ isOpen: false });
    }

    public static show() {
        alert("Show and tell");
        if (!AutoSegmentSettingsDialog.singleton) {
            new AutoSegmentSettingsDialog({});
        }
        AutoSegmentSettingsDialog.singleton.setState({
            isOpen: true
        });
        // BloomApi.get("book/metadata", result => {
        //     BookMetadataDialog.singleton.metadata = result.data.metadata;
        //     BookMetadataDialog.singleton.translatedControlStrings =
        //         result.data.translatedStringPairs;

        //     BookMetadataDialog.singleton.setState({
        //         isOpen: true
        //     });
        // });
    }

    public render() {
        return (
            <CloseOnEscape
                onEscape={() => {
                    this.handleCloseModal(false);
                }}
            >
                <ReactModal
                    ariaHideApp={false} //we're not trying to make Bloom work with screen readers
                    className="autoSegmentSettingsDialog"
                    isOpen={this.state.isOpen}
                    shouldCloseOnOverlayClick={false}
                    onRequestClose={() => this.handleCloseModal(false)}
                >
                    <Div
                        className={"dialogTitle"} // TODO: FIX ME
                        l10nKey="EditTab.asdf" // TODO: FIX ME
                    >
                        AutoSegment Settings
                    </Div>
                    {/* <div className="dialogContent">
                        <BookMetadataTable
                            metadata={this.metadata}
                            translatedControlStrings={
                                this.translatedControlStrings
                            }
                        />
                        <div className={"bottomButtonRow"}>
                            <BloomButton
                                id="helpButton"
                                enabled={true}
                                l10nKey="Common.Help"
                                clickEndpoint="help/User_Interface/Dialog_boxes/Book_Metadata_dialog_box.htm"
                                hasText={true}
                            >
                                Help
                            </BloomButton>
                            <BloomButton
                                id="okButton"
                                enabled={true}
                                l10nKey="Common.OK"
                                hasText={true}
                                onClick={() => this.handleCloseModal(true)}
                            >
                                OK
                            </BloomButton>
                            <BloomButton
                                enabled={true}
                                l10nKey="Common.Cancel"
                                hasText={true}
                                onClick={() => this.handleCloseModal(false)}
                            >
                                Cancel
                            </BloomButton>
                        </div>
                    </div> */}
                </ReactModal>
            </CloseOnEscape>
        );
    }
}
