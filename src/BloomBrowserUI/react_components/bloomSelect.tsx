import * as React from "react";
import Select from "react-select";
import theOneLocalizationManager from "../lib/localizationManager/localizationManager";
import * as mobxReact from "mobx-react";

export interface IProps {
    // I don't know how to express exact types in Typescript here and it doesn't seem worth a lot of effort.
    currentOption: any; // { key, value }, only value is used here
    options: any; // { value, label, l10nKey, comment }, first two used by Select.
    nullOption: string; // option .value key associated with not having chosen one of the real options
    className: string;
}

// @mobxReact.observer means mobx will automatically track which observables this component uses
// in its render attribute function, and then re-render when they change. The "observable" here
// would be currentOption as set somewhere in a parent control.  That is why currentOption is
// defined as "any" instead of "string", so that the object reference can tie back to the parent
// control's data.  If nothing is set as an observable, then there won't be automatic re-rendering.
@mobxReact.observer
export class BloomSelect extends React.Component<IProps> {
    constructor(props) {
        super(props);

        this.props.options.map(item => {
            if (item.l10nKey) {
                theOneLocalizationManager
                    .asyncGetTextAndSuccessInfo(
                        item.l10nKey,
                        item.label,
                        item.comment ? item.comment : ""
                    )
                    .done(result => {
                        item.label = result.text;
                    });
            }
        });
    }

    public render() {
        const selectedOption = this.props.currentOption.value
            ? this.props.options.filter(
                  x => x.value === this.props.currentOption.value
              )[0]
            : this.props.options.filter(
                  x => x.value === this.props.nullOption
              )[0];

        return (
            <Select
                value={selectedOption}
                onChange={selectedOption => this.handleChange(selectedOption)}
                options={this.props.options}
                className={this.props.className}
            />
        );
    }

    public handleChange(selectedOption) {
        if (selectedOption.value == this.props.nullOption) {
            this.props.currentOption.value = "";
        } else {
            this.props.currentOption.value = selectedOption.value;
        }
    }
}

export default BloomSelect;
