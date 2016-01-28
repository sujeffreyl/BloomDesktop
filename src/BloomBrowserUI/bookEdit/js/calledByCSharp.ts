import { ReaderToolsWindow} from "../toolbox/decodableReader/readerToolsModel";

export class CalledByCSharp {

 ckEditorUndoCommand(): any {
     try {
         return (<any>this.getPageContent()).CKEDITOR.instances.editor1.commands.undo;
     }
     catch (e) {
         return null;
     }
 }

  pageSelectionChanging() {
    var contentWindow = this.getPageContent();
    contentWindow['pageSelectionChanging']();
  }

  disconnectForGarbageCollection() {
      var contentWindow = this.getPageContent();
      contentWindow['disconnectForGarbageCollection']();
  }

  loadReaderToolSettings(settings: string, bookFontName: string) {

    var contentWindow = this.getToolboxWindow();
    if (!contentWindow) return;

    if (typeof contentWindow['initializeSynphony'] === 'function')
      contentWindow['initializeSynphony'](settings, bookFontName);
  }

  setSampleTextsList(fileList: string) {
    this.invokeToolboxWithOneParameter('setTextsList', fileList);
  }

  setSampleFileContents(fileContents: string) {
    this.invokeToolboxWithOneParameter('setSampleFileContents', fileContents);
  }

  setCopyrightAndLicense(contents) {

    var contentWindow = this.getPageContent();
    if (!contentWindow) return;

    if (typeof contentWindow['SetCopyrightAndLicense'] === 'function')
      contentWindow['SetCopyrightAndLicense'](contents);
  }

    cleanupAudio() {
        var contentWindow = this.getPageContent();
        if (!contentWindow) return;
        if (typeof contentWindow['cleanupAudio'] === 'function') {
            contentWindow['cleanupAudio']();
        }
    }

    setPeakLevel(level: string) {
        var toolboxWindow = this.getToolboxWindow();
        if (!toolboxWindow) return;
        if (typeof toolboxWindow['setPeakLevel'] === 'function') {
            toolboxWindow['setPeakLevel'](level);
        }
    }

  removeSynphonyMarkup() {
    var page = this.getPageContent();
    if (!page) return;
    var toolbox = this.getToolboxWindow();
    if ((typeof toolbox['jQuery'] !== 'undefined') && (toolbox['jQuery'].fn.removeSynphonyMarkup)) {
        toolbox['jQuery'].fn.removeSynphonyMarkup.call(page['jQuery']('.bloom-content1'));
    }
  }

  invokeToolboxWithOneParameter(functionName: string, value: string) {

    var contentWindow = this.getToolboxWindow();
    if (!contentWindow) return;

    if (typeof contentWindow[functionName] === 'function')
      contentWindow[functionName](value);
  }

  getPageContent(): Window {
    var page = <HTMLIFrameElement>document.getElementById('page');
    return (page) ? page.contentWindow : null;
  }

  getToolboxWindow(): ReaderToolsWindow {
    var toolbox = <HTMLIFrameElement>document.getElementById('toolbox');
    return (toolbox) ? <ReaderToolsWindow>toolbox.contentWindow : null;
  }
}
