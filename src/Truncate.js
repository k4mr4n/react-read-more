import React, {Component} from 'react';
import PropTypes from 'prop-types';

export default class Truncate extends Component {
  static propTypes = {
    children: PropTypes.node,
    ellipsis: PropTypes.node,
    lines: PropTypes.oneOfType([
      PropTypes.oneOf([false]),
      PropTypes.number
    ]),
    options: PropTypes.object,
    onTruncate: PropTypes.func
  };

  static defaultProps = {
    children: '',
    ellipsis: '…',
    options: {},
    lines: 1
  };

  state = {};

  constructor(...args) {
    super(...args);

    this.onResize = this.onResize.bind(this);
    this.onTruncate = this.onTruncate.bind(this);
    this.calcTargetWidth = this.calcTargetWidth.bind(this);
    this.measureWidth = this.measureWidth.bind(this);
    this.getLines = this.getLines.bind(this);
    this.renderLine = this.renderLine.bind(this);
  }

  componentDidMount() {
    this.init();
  }

  init() {
    if (this.text === null) {
      return;
    }
    // Node not needed in document tree to read its content
    this.refs.text.parentNode.removeChild(this.refs.text);

    // Keep node in document body to read .offsetWidth
    document.body.appendChild(this.refs.ellipsis);

    const canvas = document.createElement('canvas');
    this.canvas = canvas.getContext('2d');

    window.addEventListener('resize', this.onResize);

    this.onResize();
  }

  componentDidUpdate(prevProps) {
    // Render was based on outdated refs and needs to be rerun
    if (this.props.children !== prevProps.children) {
      this.forceUpdate();
    }
  }

  componentWillUnmount() {
    document.body.removeChild(this.refs.ellipsis);

    window.removeEventListener('resize', this.onResize);

    cancelAnimationFrame(this.timeout);
  }

  // Shim innerText to consistently break lines at <br/> but not at \n
  innerText(node) {
    const div = document.createElement('div');
    div.innerHTML = node.innerHTML.replace(/\r\n|\r|\n/g, ' ');

    let text = div.innerText;

    const test = document.createElement('div');
    test.innerHTML = 'foo<br/>bar';

    if (test.innerText.replace(/\r\n|\r/g, '\n') !== 'foo\nbar') {
      div.innerHTML = div.innerHTML.replace(/<br.*?[\/]?>/gi, '\n');
      text = div.innerText;
    }

    return text;
  }

  onResize() {
    this.calcTargetWidth();
  }

  onTruncate(didTruncate) {
    const {
      onTruncate
    } = this.props;

    if (typeof onTruncate === 'function') {
      this.timeout = requestAnimationFrame(() => {
        onTruncate(didTruncate);
      });
    }
  }

  calcTargetWidth() {
    const {
      refs: {
        target
      },
      calcTargetWidth,
      canvas
    } = this;

    // Calculation is no longer relevant, since node has been removed
    if (!target) {
      return;
    }

    const targetWidth = this.props.options.fixedWidth || target.parentNode.getBoundingClientRect().width;

    // Delay calculation until parent node is inserted to the document
    // Mounting order in React is ChildComponent, ParentComponent
    if (!targetWidth) {
      return requestAnimationFrame(calcTargetWidth);
    }

    const style = window.getComputedStyle(target);

    const font = [
      style['font-weight'],
      style['font-style'],
      style['font-size'],
      style['font-family']
    ].join(' ');

    canvas.font = font;

    this.setState({
      targetWidth
    });
  }

  measureWidth(text) {
    return this.canvas.measureText(text).width;
  }

  ellipsisWidth(node) {
    return node.offsetWidth;
  }

  getLines() {
    const {
      refs,
      props: {
        lines: numLines,
        ellipsis
      },
      state: {
        targetWidth
      },
      innerText,
      measureWidth,
      onTruncate
    } = this;

    const lines = [];
    const text = innerText(refs.text);
    const textLines = text.split('\n').map(line => line.split(' '));
    let didTruncate = true;
    const ellipsisWidth = this.ellipsisWidth(this.refs.ellipsis);

    for (let line = 1; line <= numLines; line++) {
      const textWords = textLines[0];

      // Handle newline
      if (textWords.length === 0) {
        lines.push();
        textLines.shift();
        line--;
        continue;
      }

      let resultLine = textWords.join(' ');

      if (measureWidth(resultLine) < targetWidth) {
        if (textLines.length === 1) {
          // Line is end of text and fits without truncating //
          didTruncate = false;

          lines.push(resultLine);
          break;
        }
      }

      if (line === numLines) {
        // Binary search determining the longest possible line inluding truncate string //
        const textRest = textWords.join(' ');

        let lower = 0;
        let upper = textRest.length - 1;

        while (lower <= upper) {
          const middle = Math.floor((lower + upper) / 2);

          const testLine = textRest.slice(0, middle + 1);

          if (measureWidth(testLine) + ellipsisWidth <= targetWidth) {
            lower = middle + 1;
          } else {
            upper = middle - 1;
          }
        }

        resultLine = <span>{textRest.slice(0, lower)}{ellipsis}</span>;
      } else {
        // Binary search determining when the line breaks //
        let lower = 0;
        let upper = textWords.length - 1;

        while (lower <= upper) {
          const middle = Math.floor((lower + upper) / 2);

          const testLine = textWords.slice(0, middle + 1).join(' ');

          if (measureWidth(testLine) <= targetWidth) {
            lower = middle + 1;
          } else {
            upper = middle - 1;
          }
        }

        // The first word of this line is too long to fit it
        if (lower === 0) {
          // Jump to processing of last line
          line = numLines - 1;
          continue;
        }

        resultLine = textWords.slice(0, lower).join(' ');
        textLines[0].splice(0, lower);
      }

      lines.push(resultLine);
    }

    onTruncate(didTruncate);

    return lines;
  }

  renderLine(line, i, arr) {
    if (i === arr.length - 1) {
      return <span key={i}>{line}</span>;
    }
    const br = <br key={i + 'br'} />;

    if (line) {
      return [
        <span key={i}>{line}</span>,
        br
      ];
    }

    return br;
  }

  render() {
    const {
      refs: {
        target
      },
      props: {
        children,
        ellipsis,
        lines,
        ...spanProps
      },
      state: {
        targetWidth
      },
      getLines,
      renderLine,
      onTruncate
    } = this;

    let text = children;

    if (typeof window !== 'undefined') {
      if (target && targetWidth && lines > 0) {
        text = getLines().map(renderLine);
      } else {
        onTruncate(false);
      }
    }

    delete spanProps.onTruncate;
    delete spanProps.options;

    return (
      <span {...spanProps} ref='target'>
        {text}
        <span ref='text'>{children}</span>
        <span ref='ellipsis' style={this.styles.ellipsis}>
          {ellipsis}
        </span>
      </span>
    );
  }

  styles = {
    ellipsis: {
      position: 'fixed',
      visibility: 'hidden',
      top: 0,
      left: 0
    }
  };
}
