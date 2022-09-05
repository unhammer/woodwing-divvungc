# We use nightly packages:
FROM divvun:woodwing-base

ENV LC_ALL C.UTF-8

# We get apertium-apy from git, since we need divvunWoodwing branch

RUN git clone -b divvunWoodwing https://github.com/apertium/apertium-apy /apy

# ADD ./data.bin /

WORKDIR /

# For now this just works for one pipeline, but should be easy to
# generalise if we ever need to:

ENV iso639=sme
ENV bcp47=se
ENV package=giella-"${iso639}"-speller
ENV pipename="${iso639}"spell
ENV modename="${iso639}"-"${iso639}"_spell
ENV zcheck=./usr/share/voikko/4/"${bcp47}".zcheck

RUN mkdir /data
RUN unzip -d data "${zcheck}"

# TODO: currently messed up in zcheck:
# RUN rm -f data/spellchecker.bin
# RUN cg-comp /data/"${iso639}"/spellchecker.cg3 data/spellchecker.bin

RUN mkdir /modes
RUN divvun-gen-sh -j data/pipespec.xml "${pipename}" \
    | grep -v '^#'                               \
    | tr '\n' ' '                                \
    | sed 's/\\ //g'                             \
    > modes/"${modename}".mode

EXPOSE 2737
# CMD bash
CMD python3 /apy/servlet.py      \
        /modes                   \
        --max-idle-secs 3600     \
        --restart-pipe-after 200 \
        --max-pipes-per-pair 2   \
        --max-users-per-pipe 1
